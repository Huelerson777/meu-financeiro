import { Body, Controller, Delete, Get, Param, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { McpOAuthService, RedirectableOAuthError } from './mcp-oauth.service';
import { OAuthConsentDto } from './dto/oauth-consent.dto';

/**
 * Endpoints OAuth 2.1 exigidos pela spec de MCP remoto (Dynamic Client
 * Registration + Authorization Code com PKCE). Ficam FORA do prefixo global
 * `/api` (ver main.ts) — exceto `consent`, chamado já autenticado pelo
 * próprio frontend, que mantém o prefixo/interceptors padrão da API.
 *
 * As demais rotas respondem no formato exato exigido pela spec OAuth (não no
 * envelope `{ success, data }` do resto da API), por isso usam `@Res()` bruto
 * em vez de deixar o TransformInterceptor global processar o retorno.
 */
@ApiExcludeController()
@Controller()
export class McpOAuthController {
  constructor(private readonly oauthService: McpOAuthService) {}

  @Get('.well-known/oauth-authorization-server')
  authorizationServerMetadata(@Req() req: Request, @Res() res: Response) {
    res.json(this.oauthService.getAuthorizationServerMetadata(originOf(req)));
  }

  @Get('.well-known/oauth-protected-resource')
  protectedResourceMetadata(@Req() req: Request, @Res() res: Response) {
    res.json(this.oauthService.getProtectedResourceMetadata(originOf(req)));
  }

  // Registro é aberto (sem autenticação) por exigência da spec — o limite
  // evita que alguém encha a tabela de clientes.
  @Post('mcp/oauth/register')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async register(@Body() body: any, @Res() res: Response) {
    try {
      const client = await this.oauthService.registerClient(body);
      res.status(201).json(client);
    } catch (err) {
      res.status(400).json({ error: 'invalid_client_metadata', error_description: (err as Error).message });
    }
  }

  @Get('mcp/oauth/authorize')
  async authorize(@Query() query: Record<string, string>, @Res() res: Response) {
    try {
      const redirectUrl = await this.oauthService.buildAuthorizeRedirect(query);
      res.redirect(302, redirectUrl);
    } catch (err) {
      if (err instanceof RedirectableOAuthError) {
        res.redirect(302, err.redirectUrl);
        return;
      }
      res.status(400).json({ error: 'invalid_request', error_description: (err as Error).message });
    }
  }

  @Post('mcp/oauth/token')
  async token(@Body() body: any, @Res() res: Response) {
    try {
      const grantType = body?.grant_type;
      if (grantType === 'authorization_code') {
        res.json(await this.oauthService.exchangeAuthorizationCode(body));
      } else if (grantType === 'refresh_token') {
        res.json(await this.oauthService.refreshToken(body));
      } else {
        res.status(400).json({ error: 'unsupported_grant_type' });
      }
    } catch (err) {
      res.status(400).json({ error: 'invalid_grant', error_description: (err as Error).message });
    }
  }

  /**
   * Único endpoint deste controller sob `/api` (ver main.ts) — chamado pela
   * tela de consentimento (frontend/app/mcp/authorize) já autenticada pelo
   * login normal do PouPay.
   */
  /**
   * Também sob "/api": a tela de consentimento confere aqui o cliente e a
   * redirect_uri antes de mostrar os botões (ver McpOAuthService.getClientInfo).
   */
  @UseGuards(JwtAuthGuard)
  @Get('mcp/oauth/client')
  clientInfo(@Query('client_id') clientId?: string, @Query('redirect_uri') redirectUri?: string) {
    return this.oauthService.getClientInfo(clientId, redirectUri);
  }

  @UseGuards(JwtAuthGuard)
  @Post('mcp/oauth/consent')
  consent(@CurrentUser() user: { id: string }, @Body() dto: OAuthConsentDto) {
    return this.oauthService.createAuthorizationCode(user.id, dto);
  }

  /** Aplicativos conectados à conta (Configurações) — também sob "/api". */
  @UseGuards(JwtAuthGuard)
  @Get('mcp/connections')
  connections(@CurrentUser() user: { id: string }) {
    return this.oauthService.listConnections(user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('mcp/connections/:clientId')
  revokeConnection(@CurrentUser() user: { id: string }, @Param('clientId') clientId: string) {
    return this.oauthService.revokeConnection(user.id, clientId);
  }
}

function originOf(req: Request): string {
  return `${req.protocol}://${req.get('host')}`;
}
