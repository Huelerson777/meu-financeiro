process.env.JWT_SECRET = 'test-secret';

import { JwtService } from '@nestjs/jwt';
import { UserThrottlerGuard } from './user-throttler.guard';

describe('UserThrottlerGuard.getTracker', () => {
  const guard = new UserThrottlerGuard([] as any, {} as any, {} as any) as any;
  const sign = (payload: object, secret = 'test-secret') => new JwtService({ secret }).sign(payload);

  it('com access token válido, conta por usuário (não por IP)', async () => {
    const req = { ip: '10.0.0.1', originalUrl: '/api/transactions', headers: { authorization: `Bearer ${sign({ sub: 'u1' })}` } };
    await expect(guard.getTracker(req)).resolves.toBe('user:u1');
  });

  it('dois usuários atrás do mesmo IP têm contagens separadas', async () => {
    const base = { ip: '10.0.0.1', originalUrl: '/api/dashboard/summary' };
    const a = await guard.getTracker({ ...base, headers: { authorization: `Bearer ${sign({ sub: 'u1' })}` } });
    const b = await guard.getTracker({ ...base, headers: { authorization: `Bearer ${sign({ sub: 'u2' })}` } });
    expect(a).not.toBe(b);
  });

  it('sem token, com token forjado ou vencido, conta pelo IP', async () => {
    const forged = sign({ sub: 'u1' }, 'outro-segredo');
    const expired = new JwtService({ secret: 'test-secret' }).sign({ sub: 'u1' }, { expiresIn: -10 });
    await expect(guard.getTracker({ ip: '10.0.0.1', originalUrl: '/api/health', headers: {} })).resolves.toBe('10.0.0.1');
    await expect(guard.getTracker({ ip: '10.0.0.1', originalUrl: '/api/x', headers: { authorization: `Bearer ${forged}` } })).resolves.toBe('10.0.0.1');
    await expect(guard.getTracker({ ip: '10.0.0.1', originalUrl: '/api/x', headers: { authorization: `Bearer ${expired}` } })).resolves.toBe('10.0.0.1');
  });

  it('rotas de autenticação contam sempre pelo IP, mesmo com token válido', async () => {
    const req = { ip: '10.0.0.1', originalUrl: '/api/auth/login', headers: { authorization: `Bearer ${sign({ sub: 'u1' })}` } };
    await expect(guard.getTracker(req)).resolves.toBe('10.0.0.1');
  });
});
