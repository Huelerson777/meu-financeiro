import { BadRequestException, ConflictException, ForbiddenException, HttpException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';

process.env.JWT_SECRET = 'test-secret';

function build(user: any) {
  const codes: any[] = [];
  const prisma: any = {
    user: {
      findUnique: jest.fn().mockResolvedValue(user),
      findFirst: jest.fn().mockResolvedValue(user),
      create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'u1', ...data, settings: undefined })),
      update: jest.fn().mockResolvedValue(user),
    },
    emailVerificationCode: {
      findFirst: jest.fn().mockImplementation(() => Promise.resolve(codes[codes.length - 1] ?? null)),
      deleteMany: jest.fn().mockImplementation(() => { codes.length = 0; return Promise.resolve(); }),
      create: jest.fn().mockImplementation(({ data }) => {
        const row = { id: 'c1', attempts: 0, createdAt: new Date(), ...data };
        codes.push(row);
        return Promise.resolve(row);
      }),
      update: jest.fn().mockImplementation(({ data }) => { codes[0].attempts += data.attempts.increment; return Promise.resolve(); }),
    },
    refreshToken: {
      create: jest.fn().mockResolvedValue({}),
      findUnique: jest.fn(),
      update: jest.fn().mockResolvedValue({}),
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    $transaction: jest.fn().mockImplementation((ops) => Promise.all(ops)),
  };
  const jwt: any = { sign: jest.fn().mockReturnValue('access') };
  const categories: any = { ensureDefaults: jest.fn() };
  const mail: any = { send: jest.fn() };
  const service = new AuthService(prisma, jwt, categories, mail);
  const sentCode = () => /<p style="font-size:32px[^>]*>(\d{6})</.exec(mail.send.mock.calls.at(-1)[2])![1];
  return { service, prisma, mail, sentCode };
}

const baseUser = {
  id: 'u1', name: 'Maria', email: 'm@x.com', role: 'USER', isActive: true,
  emailVerifiedAt: null, emailVerificationRequired: true, passwordHash: '',
};

describe('AuthService — verificação de e-mail', () => {
  it('register não emite tokens e envia o código', async () => {
    const { service, mail } = build(null);
    const res = await service.register({ name: 'Maria', email: 'm@x.com', password: '123456' });
    expect(res).toEqual({ requiresVerification: true, email: 'm@x.com' });
    expect(mail.send).toHaveBeenCalledTimes(1);
  });

  it('register recusa e-mail já verificado', async () => {
    const { service } = build({ ...baseUser, emailVerifiedAt: new Date() });
    await expect(service.register({ name: 'M', email: 'm@x.com', password: '123456' })).rejects.toBeInstanceOf(ConflictException);
  });

  it('register recusa conta antiga (sem exigência de verificação)', async () => {
    const { service } = build({ ...baseUser, emailVerificationRequired: false });
    await expect(service.register({ name: 'M', email: 'm@x.com', password: '123456' })).rejects.toBeInstanceOf(ConflictException);
  });

  it('código correto verifica e devolve tokens', async () => {
    const { service, prisma, sentCode } = build(baseUser);
    await service.sendVerificationCode(baseUser, { force: true });
    const tokens = await service.verifyEmail('m@x.com', sentCode());
    expect(tokens.accessToken).toBe('access');
    expect(prisma.user.update).toHaveBeenCalledWith(expect.objectContaining({ data: { emailVerifiedAt: expect.any(Date) } }));
  });

  it('código errado é rejeitado e conta tentativa; após 5 bloqueia até o código certo', async () => {
    const { service, sentCode } = build(baseUser);
    await service.sendVerificationCode(baseUser, { force: true });
    const right = sentCode();
    const wrong = right === '000000' ? '111111' : '000000';
    for (let i = 0; i < 5; i++) {
      await expect(service.verifyEmail('m@x.com', wrong)).rejects.toBeInstanceOf(BadRequestException);
    }
    await expect(service.verifyEmail('m@x.com', right)).rejects.toThrow('Muitas tentativas');
  });

  it('código expirado é rejeitado', async () => {
    const { service, prisma, sentCode } = build(baseUser);
    await service.sendVerificationCode(baseUser, { force: true });
    const code = sentCode();
    const row = await prisma.emailVerificationCode.findFirst();
    row.expiresAt = new Date(Date.now() - 1000);
    await expect(service.verifyEmail('m@x.com', code)).rejects.toThrow('inválido ou expirado');
  });

  it('conta já verificada não gera tokens pelo endpoint público', async () => {
    const { service } = build({ ...baseUser, emailVerifiedAt: new Date() });
    await expect(service.verifyEmail('m@x.com', '123456')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('reenvio respeita o intervalo mínimo', async () => {
    const { service, mail } = build(baseUser);
    await service.sendVerificationCode(baseUser, { force: true });
    await service.resendVerification('m@x.com');
    expect(mail.send).toHaveBeenCalledTimes(1);
  });

  it('login de conta nova não verificada é barrado com EMAIL_NOT_VERIFIED', async () => {
    const passwordHash = await bcrypt.hash('123456', 4);
    const { service } = build({ ...baseUser, passwordHash });
    const err: any = await service.login({ email: 'm@x.com', password: '123456' } as any).catch((e) => e);
    expect(err).toBeInstanceOf(ForbiddenException);
    expect(err.getResponse().code).toBe('EMAIL_NOT_VERIFIED');
  });

  it('login de conta antiga não verificada passa (só recebe aviso no app)', async () => {
    const passwordHash = await bcrypt.hash('123456', 4);
    const { service } = build({ ...baseUser, passwordHash, emailVerificationRequired: false });
    await expect(service.login({ email: 'm@x.com', password: '123456' } as any)).resolves.toHaveProperty('accessToken');
  });
});

describe('AuthService — login e sessão', () => {
  it('e-mail é normalizado: "  M@X.com " entra na conta m@x.com', async () => {
    const passwordHash = await bcrypt.hash('123456', 4);
    const { service, prisma } = build({ ...baseUser, passwordHash, emailVerificationRequired: false });
    await expect(service.login({ email: '  M@X.com ', password: '123456' } as any)).resolves.toHaveProperty('accessToken');
    expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { email: 'm@x.com' } });
  });

  it('cadastro grava o e-mail em minúsculas', async () => {
    const { service, prisma } = build(null);
    await service.register({ name: 'Maria', email: 'Maria@X.com', password: '123456' });
    expect(prisma.user.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ email: 'maria@x.com' }) }));
  });

  it('e-mail inexistente e senha errada dão o mesmo erro', async () => {
    const passwordHash = await bcrypt.hash('123456', 4);
    const missing = build(null);
    const wrong = build({ ...baseUser, passwordHash });
    await expect(missing.service.login({ email: 'x@x.com', password: '123456' } as any)).rejects.toThrow('Credenciais inválidas');
    await expect(wrong.service.login({ email: 'm@x.com', password: 'errada' } as any)).rejects.toThrow('Credenciais inválidas');
  });

  it('bloqueia a conta após 10 senhas erradas seguidas, mesmo com a senha certa depois', async () => {
    const passwordHash = await bcrypt.hash('123456', 4);
    const { service } = build({ ...baseUser, passwordHash, emailVerificationRequired: false });
    for (let i = 0; i < 10; i++) {
      await expect(service.login({ email: 'm@x.com', password: 'errada' } as any)).rejects.toBeInstanceOf(UnauthorizedException);
    }
    const err: any = await service.login({ email: 'M@x.com', password: '123456' } as any).catch((e) => e);
    expect(err).toBeInstanceOf(HttpException);
    expect(err.getStatus()).toBe(429);
  });

  it('login certo zera a contagem de erros', async () => {
    const passwordHash = await bcrypt.hash('123456', 4);
    const { service } = build({ ...baseUser, passwordHash, emailVerificationRequired: false });
    for (let round = 0; round < 3; round++) {
      for (let i = 0; i < 9; i++) {
        await expect(service.login({ email: 'm@x.com', password: 'errada' } as any)).rejects.toBeInstanceOf(UnauthorizedException);
      }
      await expect(service.login({ email: 'm@x.com', password: '123456' } as any)).resolves.toHaveProperty('accessToken');
    }
  });

  it('refresh de conta desativada é recusado', async () => {
    const { service, prisma } = build({ ...baseUser, isActive: false });
    prisma.refreshToken.findUnique.mockResolvedValue({ id: 'r1', userId: 'u1', revoked: false, expiresAt: new Date(Date.now() + 60_000) });
    await expect(service.refresh('token')).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.refreshToken.update).not.toHaveBeenCalled();
  });

  it('refresh mantém o "Lembrar de mim": sessão de 28 dias renova por 28 dias', async () => {
    const DAY = 24 * 60 * 60 * 1000;
    const { service, prisma } = build({ ...baseUser, emailVerifiedAt: new Date() });
    const createdAt = new Date(Date.now() - 2 * DAY);

    prisma.refreshToken.findUnique.mockResolvedValue({ id: 'r1', userId: 'u1', revoked: false, createdAt, expiresAt: new Date(createdAt.getTime() + 28 * DAY) });
    const remembered = await service.refresh('token');
    expect(remembered.rememberMe).toBe(true);
    const rememberedExpiry = prisma.refreshToken.create.mock.calls.at(-1)[0].data.expiresAt.getTime();
    expect(Math.round((rememberedExpiry - Date.now()) / DAY)).toBe(28);

    prisma.refreshToken.findUnique.mockResolvedValue({ id: 'r2', userId: 'u1', revoked: false, createdAt, expiresAt: new Date(createdAt.getTime() + 7 * DAY) });
    const regular = await service.refresh('token');
    expect(regular.rememberMe).toBe(false);
    const regularExpiry = prisma.refreshToken.create.mock.calls.at(-1)[0].data.expiresAt.getTime();
    expect(Math.round((regularExpiry - Date.now()) / DAY)).toBe(7);
  });

  it('forgotPassword responde igual quando o envio do e-mail falha', async () => {
    const { service, prisma, mail } = build(baseUser);
    prisma.passwordResetToken = { create: jest.fn().mockResolvedValue({}) };
    mail.send.mockRejectedValue(new Error('smtp fora do ar'));
    await expect(service.forgotPassword('m@x.com')).resolves.toEqual({
      message: 'Se este e-mail existir na nossa base, enviamos um link de recuperação.',
    });
  });
});
