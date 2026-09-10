import { Body, Controller, Get, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
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

  @Post('mcp/oauth/register')
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
  @UseGuards(JwtAuthGuard)
  @Post('mcp/oauth/consent')
  consent(@CurrentUser() user: { id: string }, @Body() dto: OAuthConsentDto) {
    return this.oauthService.createAuthorizationCode(user.id, dto);
  }
}

function originOf(req: Request): string {
  return `${req.protocol}://${req.get('host')}`;
}
