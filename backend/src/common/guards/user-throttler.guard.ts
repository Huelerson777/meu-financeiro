import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ThrottlerGuard } from '@nestjs/throttler';

/**
 * Limite de requisições contado por USUÁRIO quando há um access token válido,
 * e por IP no resto (rotas públicas e de autenticação).
 *
 * Só por IP não serve aqui: o frontend fala com a API pelo proxy da Vercel,
 * então a API enxerga poucos IPs (os do proxy) pra todos os usuários — e o
 * limite "por IP" virava um balde só, dividido entre todo mundo.
 *
 * As rotas /api/auth continuam por IP de propósito: ali o token não prova
 * nada (login, cadastro, recuperação de senha são o alvo de abuso) e a
 * proteção por conta fica com o AttemptLimiter do AuthService.
 */
@Injectable()
export class UserThrottlerGuard extends ThrottlerGuard {
  private readonly jwt = new JwtService({ secret: process.env.JWT_SECRET });

  protected async getTracker(req: Record<string, any>): Promise<string> {
    const ip: string = req.ips?.length ? req.ips[0] : req.ip;
    const url: string = req.originalUrl ?? req.url ?? '';
    if (url.startsWith('/api/auth/')) return ip;

    const header = req.headers?.authorization;
    if (typeof header === 'string' && header.startsWith('Bearer ')) {
      try {
        const payload = this.jwt.verify<{ sub?: string }>(header.slice('Bearer '.length));
        if (payload?.sub) return `user:${payload.sub}`;
      } catch {
        // Token inválido, vencido ou de outro tipo (ex: MCP): conta pelo IP.
      }
    }
    return ip;
  }
}
