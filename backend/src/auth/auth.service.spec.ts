import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';

process.env.JWT_SECRET = 'test-secret';

function build(user: any) {
  const codes: any[] = [];
  const prisma: any = {
    user: {
      findUnique: jest.fn().mockResolvedValue(user),
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
    refreshToken: { create: jest.fn().mockResolvedValue({}) },
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
