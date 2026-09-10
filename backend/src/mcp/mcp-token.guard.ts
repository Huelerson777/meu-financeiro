import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import * as crypto from 'crypto';
import type { Request, Response } from 'express';
import { PrismaService } from '../common/prisma/prisma.service';

/**
 * Protege o endpoint MCP exigindo um access token emitido pelo fluxo OAuth
 * deste módulo (ver mcp-oauth.service.ts) — nunca compara o token em texto
 * puro, só o hash SHA-256 (mesmo padrão do JWT refresh token).
 *
 * Diferente do JwtAuthGuard, injeta `request.mcpUserId` (não `request.user`)
 * — mantém os dois fluxos de autenticação claramente separados.
 */
@Injectable()
export class McpTokenGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & { mcpUserId?: string }>();
    const response = context.switchToHttp().getResponse<Response>();

    // Exigido pela spec de MCP remoto: um 401 sem token precisa apontar pra
    // onde o cliente descobre o authorization server.
    const resourceMetadataUrl = `${request.protocol}://${request.get('host')}/.well-known/oauth-protected-resource`;
    response.setHeader('WWW-Authenticate', `Bearer resource_metadata="${resourceMetadataUrl}"`);

    const authHeader = request.headers['authorization'];
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : null;
    if (!token) throw new UnauthorizedException('Token de acesso MCP ausente');

    const accessTokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const stored = await this.prisma.mcpToken.findUnique({ where: { accessTokenHash } });
    if (!stored || stored.revoked || stored.accessExpiresAt < new Date()) {
      throw new UnauthorizedException('Token de acesso MCP inválido ou expirado');
    }

    request.mcpUserId = stored.userId;
    return true;
  }
}
