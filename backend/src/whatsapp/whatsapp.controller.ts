import { Body, Controller, Get, Headers, HttpCode, Post, Query, Req, Res } from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request, Response } from 'express';
import { ApiExcludeController } from '@nestjs/swagger';
import { WhatsappService } from './whatsapp.service';

/**
 * Webhook chamado pela Meta (WhatsApp Cloud API) — não usa JwtAuthGuard,
 * já que a Meta não manda nosso JWT. A segurança aqui é outra: o handshake
 * GET confere um token secreto combinado no dashboard da Meta, e o POST
 * confere a assinatura HMAC do corpo (ver WhatsappService.verifySignature).
 */
@ApiExcludeController()
@Controller('whatsapp')
export class WhatsappController {
  constructor(private readonly whatsappService: WhatsappService) {}

  @Get('webhook')
  verifyWebhook(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
    @Res() res: Response,
  ) {
    if (mode === 'subscribe' && token && token === process.env.WHATSAPP_VERIFY_TOKEN) {
      res.status(200).send(challenge);
      return;
    }
    res.status(403).send('Token de verificação inválido');
  }

  @Post('webhook')
  @HttpCode(200)
  async receiveWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-hub-signature-256') signature: string,
    @Body() body: any,
  ) {
    if (!this.whatsappService.verifySignature(req.rawBody, signature)) {
      return { ignored: true };
    }

    await this.whatsappService.handleWebhookPayload(body);
    return { received: true };
  }
}
