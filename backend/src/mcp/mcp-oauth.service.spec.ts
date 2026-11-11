import { BadRequestException } from '@nestjs/common';
import { McpOAuthService, isAllowedRedirectUri } from './mcp-oauth.service';

describe('isAllowedRedirectUri', () => {
  it('aceita https e http em loopback', () => {
    expect(isAllowedRedirectUri('https://claude.ai/api/mcp/auth_callback')).toBe(true);
    expect(isAllowedRedirectUri('http://localhost:53124/callback')).toBe(true);
    expect(isAllowedRedirectUri('http://127.0.0.1:8080/cb')).toBe(true);
  });

  it('recusa esquemas que executam script ou saem do http(s)', () => {
    expect(isAllowedRedirectUri('javascript:alert(document.domain)//')).toBe(false);
    expect(isAllowedRedirectUri('data:text/html,<script>alert(1)</script>')).toBe(false);
    expect(isAllowedRedirectUri('file:///etc/passwd')).toBe(false);
    expect(isAllowedRedirectUri('myapp://callback')).toBe(false);
  });

  it('recusa http fora de loopback, fragmento, credenciais e valores não-URL', () => {
    expect(isAllowedRedirectUri('http://evil.example/cb')).toBe(false);
    expect(isAllowedRedirectUri('http://localhost.evil.example/cb')).toBe(false);
    expect(isAllowedRedirectUri('https://app.example/cb#frag')).toBe(false);
    expect(isAllowedRedirectUri('https://user:pass@app.example/cb')).toBe(false);
    expect(isAllowedRedirectUri('nao-e-url')).toBe(false);
    expect(isAllowedRedirectUri('')).toBe(false);
    expect(isAllowedRedirectUri(undefined)).toBe(false);
    expect(isAllowedRedirectUri(42)).toBe(false);
    expect(isAllowedRedirectUri(`https://a.example/${'x'.repeat(3000)}`)).toBe(false);
  });
});

describe('McpOAuthService', () => {
  function build(client: any = null) {
    const prisma: any = {
      mcpClient: {
        create: jest.fn().mockResolvedValue({}),
        findUnique: jest.fn().mockResolvedValue(client),
      },
      mcpAuthorizationCode: { create: jest.fn().mockResolvedValue({}) },
    };
    return { service: new McpOAuthService(prisma), prisma };
  }

  describe('registerClient', () => {
    it('registra cliente com redirect_uris válidas e limpa o nome', async () => {
      const { service, prisma } = build();
      const res = await service.registerClient({
        redirect_uris: ['https://claude.ai/api/mcp/auth_callback'],
        client_name: `  Claude\u0000\n${'x'.repeat(300)}`,
      });

      expect(res.redirect_uris).toEqual(['https://claude.ai/api/mcp/auth_callback']);
      expect(res.client_name).toHaveLength(100);
      expect(res.client_name).not.toMatch(/[\u0000-\u001f]/);
      expect(prisma.mcpClient.create).toHaveBeenCalledTimes(1);
    });

    it('recusa redirect_uri javascript: (XSS na tela de consentimento)', async () => {
      const { service, prisma } = build();
      await expect(
        service.registerClient({ redirect_uris: ['https://ok.example/cb', 'javascript:alert(1)//'] }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.mcpClient.create).not.toHaveBeenCalled();
    });

    it('recusa lista vazia, grande demais ou com item que não é texto', async () => {
      const { service } = build();
      await expect(service.registerClient({ redirect_uris: [] })).rejects.toBeInstanceOf(BadRequestException);
      await expect(service.registerClient({ redirect_uris: [123] })).rejects.toBeInstanceOf(BadRequestException);
      await expect(
        service.registerClient({ redirect_uris: Array.from({ length: 11 }, (_, i) => `https://a.example/${i}`) }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('getClientInfo', () => {
    const client = { clientId: 'c1', clientName: 'Claude', redirectUris: ['https://claude.ai/cb'] };

    it('devolve o nome registrado e o host de destino', async () => {
      const { service } = build(client);
      await expect(service.getClientInfo('c1', 'https://claude.ai/cb')).resolves.toEqual({
        clientName: 'Claude',
        redirectHost: 'claude.ai',
      });
    });

    it('recusa redirect_uri que não é do cliente, cliente inexistente e esquema perigoso', async () => {
      await expect(build(client).service.getClientInfo('c1', 'https://evil.example/cb')).rejects.toBeInstanceOf(BadRequestException);
      await expect(build(null).service.getClientInfo('c1', 'https://claude.ai/cb')).rejects.toBeInstanceOf(BadRequestException);
      // Cliente antigo, registrado antes da validação, com URI perigosa gravada no banco.
      const legacy = { ...client, redirectUris: ['javascript:alert(1)//'] };
      await expect(build(legacy).service.getClientInfo('c1', 'javascript:alert(1)//')).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  it('consent (createAuthorizationCode) também recusa redirect_uri fora do cliente', async () => {
    const { service, prisma } = build({ clientId: 'c1', clientName: null, redirectUris: ['https://claude.ai/cb'] });
    await expect(
      service.createAuthorizationCode('u1', {
        clientId: 'c1',
        redirectUri: 'https://evil.example/cb',
        codeChallenge: 'x',
        codeChallengeMethod: 'S256',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.mcpAuthorizationCode.create).not.toHaveBeenCalled();
  });
});

describe('McpOAuthService — aplicativos conectados', () => {
  const day = (n: number) => new Date(Date.UTC(2026, 9, n));
  const future = new Date(Date.now() + 86_400_000);
  const past = new Date(Date.now() - 86_400_000);

  function build(tokens: any[]) {
    const prisma: any = {
      mcpToken: {
        findMany: jest.fn().mockResolvedValue(tokens),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    return { service: new McpOAuthService(prisma), prisma };
  }

  it('lista só quem ainda tem acesso, com a data da primeira conexão', async () => {
    const claude = { clientName: 'Claude' };
    const { service } = build([
      { clientId: 'c1', createdAt: day(1), revoked: true, refreshExpiresAt: future, client: claude }, // já rotacionado
      { clientId: 'c1', createdAt: day(20), revoked: false, refreshExpiresAt: future, client: claude },
      { clientId: 'c2', createdAt: day(5), revoked: true, refreshExpiresAt: future, client: { clientName: 'Revogado' } },
      { clientId: 'c3', createdAt: day(6), revoked: false, refreshExpiresAt: past, client: { clientName: 'Vencido' } },
    ]);

    await expect(service.listConnections('u1')).resolves.toEqual([
      { clientId: 'c1', clientName: 'Claude', connectedAt: day(1), lastRenewedAt: day(20) },
    ]);
  });

  it('revogar corta todos os tokens ativos daquele aplicativo, só do próprio usuário', async () => {
    const { service, prisma } = build([]);
    await expect(service.revokeConnection('u1', 'c1')).resolves.toEqual({ revoked: true });
    expect(prisma.mcpToken.updateMany).toHaveBeenCalledWith({
      where: { userId: 'u1', clientId: 'c1', revoked: false },
      data: { revoked: true },
    });
  });

  it('revogar conexão que não existe (ou de outro usuário) dá 404', async () => {
    const { service, prisma } = build([]);
    prisma.mcpToken.updateMany.mockResolvedValue({ count: 0 });
    await expect(service.revokeConnection('u1', 'c-de-outro')).rejects.toThrow('Conexão não encontrada');
  });
});
