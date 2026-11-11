import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../common/prisma/prisma.service';

const ACCESS_TOKEN_TTL_MS = 90 * 24 * 60 * 60 * 1000; // 90 dias — clientes MCP remotos nem sempre fazem refresh silencioso
const REFRESH_TOKEN_TTL_MS = 90 * 24 * 60 * 60 * 1000; // 90 dias
const AUTH_CODE_TTL_MS = 5 * 60 * 1000; // 5 min, uso único
const MAX_REDIRECT_URIS = 10;
const MAX_REDIRECT_URI_LENGTH = 2000;
const MAX_CLIENT_NAME_LENGTH = 100;
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

/**
 * Só aceita redirect_uri https (qualquer host) ou http em loopback (cliente
 * local, ex: Claude Code em http://localhost:PORTA/callback). O registro de
 * cliente é aberto (qualquer um pode se registrar), e a tela de consentimento
 * manda o navegador pra essa URL: sem este filtro, um "javascript:..."
 * registrado como redirect_uri executaria script na origem do app (roubo de
 * sessão) quando a vítima clicasse em Autorizar/Cancelar.
 */
export function isAllowedRedirectUri(value: unknown): value is string {
  if (typeof value !== 'string' || value.length === 0 || value.length > MAX_REDIRECT_URI_LENGTH) return false;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.hash || url.username || url.password) return false;
  if (url.protocol === 'https:') return true;
  return url.protocol === 'http:' && LOOPBACK_HOSTS.has(url.hostname);
}

/**
 * Erro que carrega uma URL de redirect — usado quando o client_id/redirect_uri
 * já foram validados e o erro pode (deve, por spec) voltar pro cliente MCP via
 * redirect com `?error=...`, em vez de uma resposta direta.
 */
export class RedirectableOAuthError extends Error {
  constructor(
    public readonly redirectUrl: string,
    message: string,
  ) {
    super(message);
  }
}

/**
 * Implementação mínima de OAuth 2.1 (Dynamic Client Registration +
 * Authorization Code com PKCE) exigida pela spec de servidores MCP remotos.
 * O token emitido funciona como um Personal Access Token de verdade: nunca
 * fica em texto puro no banco, só o hash SHA-256 (mesmo padrão do
 * RefreshToken em auth.service.ts), e é revogável.
 */
@Injectable()
export class McpOAuthService {
  constructor(private prisma: PrismaService) {}

  getAuthorizationServerMetadata(origin: string) {
    return {
      issuer: origin,
      authorization_endpoint: `${origin}/mcp/oauth/authorize`,
      token_endpoint: `${origin}/mcp/oauth/token`,
      registration_endpoint: `${origin}/mcp/oauth/register`,
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code', 'refresh_token'],
      code_challenge_methods_supported: ['S256'],
      token_endpoint_auth_methods_supported: ['none'],
    };
  }

  getProtectedResourceMetadata(origin: string) {
    return {
      resource: `${origin}/mcp`,
      authorization_servers: [origin],
      bearer_methods_supported: ['header'],
    };
  }

  async registerClient(body: any) {
    const redirectUris = body?.redirect_uris;
    if (!Array.isArray(redirectUris) || redirectUris.length === 0 || redirectUris.length > MAX_REDIRECT_URIS) {
      throw new BadRequestException(`redirect_uris é obrigatório e precisa ser uma lista de 1 a ${MAX_REDIRECT_URIS} URLs`);
    }
    if (!redirectUris.every(isAllowedRedirectUri)) {
      throw new BadRequestException('redirect_uris só aceita URLs https, ou http em localhost/127.0.0.1');
    }

    // O nome aparece na tela de consentimento: sem caracteres de controle e com tamanho limitado.
    const clientName =
      typeof body?.client_name === 'string'
        ? body.client_name.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, MAX_CLIENT_NAME_LENGTH) || null
        : null;
    const clientId = crypto.randomUUID();

    await this.prisma.mcpClient.create({
      data: { clientId, clientName, redirectUris },
    });

    return {
      client_id: clientId,
      client_id_issued_at: Math.floor(Date.now() / 1000),
      redirect_uris: redirectUris,
      client_name: clientName ?? undefined,
      token_endpoint_auth_method: 'none',
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
    };
  }

  /**
   * Valida a requisição de /authorize e devolve a URL da tela de
   * consentimento do frontend. client_id/redirect_uri são validados aqui
   * "fail closed" (sem redirect em caso de erro — evita open redirect);
   * qualquer outro problema (response_type/code_challenge_method não
   * suportados) já pode voltar via redirect com `?error=`.
   */
  async buildAuthorizeRedirect(query: Record<string, string | undefined>): Promise<string> {
    const { client_id, redirect_uri, state, code_challenge, code_challenge_method, response_type, scope, resource } = query;

    if (!client_id || !redirect_uri) {
      throw new BadRequestException('client_id e redirect_uri são obrigatórios');
    }

    const client = await this.findClientForRedirect(client_id, redirect_uri);

    const errorRedirect = (error: string, description: string) => {
      const url = new URL(redirect_uri);
      url.searchParams.set('error', error);
      url.searchParams.set('error_description', description);
      if (state) url.searchParams.set('state', state);
      return url.toString();
    };

    if (response_type !== 'code') {
      throw new RedirectableOAuthError(errorRedirect('unsupported_response_type', 'Só o fluxo "code" é suportado'), 'unsupported_response_type');
    }
    if (!code_challenge || code_challenge_method !== 'S256') {
      throw new RedirectableOAuthError(errorRedirect('invalid_request', 'PKCE (S256) é obrigatório'), 'invalid_request');
    }

    const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:3000';
    const consentUrl = new URL('/mcp/authorize', frontendUrl);
    consentUrl.searchParams.set('client_id', client_id);
    consentUrl.searchParams.set('redirect_uri', redirect_uri);
    consentUrl.searchParams.set('code_challenge', code_challenge);
    consentUrl.searchParams.set('code_challenge_method', code_challenge_method);
    if (state) consentUrl.searchParams.set('state', state);
    if (scope) consentUrl.searchParams.set('scope', scope);
    if (resource) consentUrl.searchParams.set('resource', resource);
    if (client.clientName) consentUrl.searchParams.set('client_name', client.clientName);

    return consentUrl.toString();
  }

  /**
   * Chamado pelo endpoint autenticado por sessão normal (POST /api/mcp/oauth/consent)
   * quando o usuário clica em "Autorizar" na tela de consentimento — gera o
   * authorization code vinculado ao usuário logado.
   */
  async createAuthorizationCode(
    userId: string,
    params: { clientId: string; redirectUri: string; codeChallenge: string; codeChallengeMethod: string },
  ) {
    await this.findClientForRedirect(params.clientId, params.redirectUri);
    if (params.codeChallengeMethod !== 'S256') {
      throw new BadRequestException('Só o code_challenge_method S256 é suportado');
    }

    const rawCode = crypto.randomBytes(32).toString('hex');
    await this.prisma.mcpAuthorizationCode.create({
      data: {
        codeHash: this.hash(rawCode),
        userId,
        clientId: params.clientId,
        redirectUri: params.redirectUri,
        codeChallenge: params.codeChallenge,
        codeChallengeMethod: params.codeChallengeMethod,
        expiresAt: new Date(Date.now() + AUTH_CODE_TTL_MS),
      },
    });

    return { code: rawCode };
  }

  /**
   * Dados do cliente pra tela de consentimento, já validados no servidor: o
   * nome registrado (e não o que vier na URL, que qualquer um monta à mão) e
   * o host pra onde o navegador será mandado. A tela só redireciona depois
   * desta checagem — inclusive no "Cancelar".
   */
  async getClientInfo(clientId: string | undefined, redirectUri: string | undefined) {
    const client = await this.findClientForRedirect(clientId, redirectUri);
    return { clientName: client.clientName, redirectHost: new URL(redirectUri as string).host };
  }

  /** client_id registrado + redirect_uri que pertence a ele e ainda é aceita pelas regras atuais. */
  private async findClientForRedirect(clientId: string | undefined, redirectUri: string | undefined) {
    const invalid = new BadRequestException('client_id ou redirect_uri inválidos');
    if (typeof clientId !== 'string' || !clientId || !isAllowedRedirectUri(redirectUri)) throw invalid;

    const client = await this.prisma.mcpClient.findUnique({ where: { clientId } });
    if (!client || !client.redirectUris.includes(redirectUri)) throw invalid;
    return client;
  }

  async exchangeAuthorizationCode(body: any) {
    const { code, redirect_uri: redirectUri, client_id: clientId, code_verifier: codeVerifier } = body ?? {};
    if (![code, redirectUri, clientId, codeVerifier].every((v) => typeof v === 'string' && v.length > 0)) {
      throw new BadRequestException('code, redirect_uri, client_id e code_verifier são obrigatórios');
    }

    const stored = await this.prisma.mcpAuthorizationCode.findUnique({ where: { codeHash: this.hash(code) } });
    if (!stored || stored.consumed || stored.expiresAt < new Date()) {
      throw new BadRequestException('Código de autorização inválido ou expirado');
    }
    if (stored.clientId !== clientId || stored.redirectUri !== redirectUri) {
      throw new BadRequestException('client_id ou redirect_uri não conferem com o código emitido');
    }

    const expectedChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');
    if (expectedChallenge !== stored.codeChallenge) {
      throw new BadRequestException('code_verifier inválido (falha na verificação PKCE)');
    }

    return this.prisma.$transaction(async (tx) => {
      // Consome o código de forma atômica: duas trocas simultâneas do mesmo
      // código não podem emitir dois tokens (o código é de uso único).
      const claimed = await tx.mcpAuthorizationCode.updateMany({
        where: { id: stored.id, consumed: false },
        data: { consumed: true },
      });
      if (claimed.count === 0) throw new BadRequestException('Código de autorização inválido ou expirado');
      return this.issueTokens(tx as unknown as PrismaService, stored.userId, stored.clientId);
    });
  }

  async refreshToken(body: any) {
    const { refresh_token: refreshToken, client_id: clientId } = body ?? {};
    if (typeof refreshToken !== 'string' || !refreshToken) throw new BadRequestException('refresh_token é obrigatório');

    const stored = await this.prisma.mcpToken.findUnique({ where: { refreshTokenHash: this.hash(refreshToken) } });
    if (!stored || stored.revoked || stored.refreshExpiresAt < new Date()) {
      throw new BadRequestException('refresh_token inválido ou expirado');
    }
    if (clientId && stored.clientId !== clientId) {
      throw new BadRequestException('client_id não confere com o refresh_token');
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.mcpToken.update({ where: { id: stored.id }, data: { revoked: true } });
      return this.issueTokens(tx as unknown as PrismaService, stored.userId, stored.clientId);
    });
  }

  /**
   * Aplicativos que hoje têm acesso à conta do usuário (tela de
   * Configurações). O token é trocado a cada renovação, então a "conexão" é
   * o conjunto de tokens daquele cliente: vale desde o primeiro emitido.
   */
  async listConnections(userId: string) {
    const now = new Date();
    const tokens = await this.prisma.mcpToken.findMany({
      where: { userId },
      select: {
        clientId: true,
        createdAt: true,
        revoked: true,
        refreshExpiresAt: true,
        client: { select: { clientName: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    const byClient = new Map<
      string,
      { clientId: string; clientName: string | null; connectedAt: Date; lastRenewedAt: Date; active: boolean }
    >();
    for (const token of tokens) {
      const entry = byClient.get(token.clientId) ?? {
        clientId: token.clientId,
        clientName: token.client.clientName,
        connectedAt: token.createdAt,
        lastRenewedAt: token.createdAt,
        active: false,
      };
      entry.lastRenewedAt = token.createdAt;
      if (!token.revoked && token.refreshExpiresAt > now) entry.active = true;
      byClient.set(token.clientId, entry);
    }

    return [...byClient.values()]
      .filter((c) => c.active)
      .map(({ active: _active, ...connection }) => connection);
  }

  /** Corta o acesso de um aplicativo: revoga todos os tokens dele pra este usuário. */
  async revokeConnection(userId: string, clientId: string) {
    const result = await this.prisma.mcpToken.updateMany({
      where: { userId, clientId, revoked: false },
      data: { revoked: true },
    });
    if (result.count === 0) throw new NotFoundException('Conexão não encontrada');
    return { revoked: true };
  }

  private async issueTokens(db: PrismaService, userId: string, clientId: string) {
    const accessToken = crypto.randomBytes(32).toString('hex');
    const refreshToken = crypto.randomBytes(32).toString('hex');
    const now = Date.now();

    await db.mcpToken.create({
      data: {
        userId,
        clientId,
        accessTokenHash: this.hash(accessToken),
        refreshTokenHash: this.hash(refreshToken),
        accessExpiresAt: new Date(now + ACCESS_TOKEN_TTL_MS),
        refreshExpiresAt: new Date(now + REFRESH_TOKEN_TTL_MS),
      },
    });

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      token_type: 'Bearer',
      expires_in: ACCESS_TOKEN_TTL_MS / 1000,
    };
  }

  private hash(value: string): string {
    return crypto.createHash('sha256').update(value).digest('hex');
  }
}
