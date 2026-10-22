import { Body, Controller, Get, Headers, HttpCode, Logger, Post, Query, Req, Res } from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request, Response } from 'express';
import { ApiExcludeController } from '@nestjs/swagger';
import { WhatsappService } from './whatsapp.service';
import { buildTwiml } from './whatsapp-utils';

/**
 * Webhook chamado pela Meta (WhatsApp Cloud API) — não usa JwtAuthGuard,
 * já que a Meta não manda nosso JWT. A segurança aqui é outra: o handshake
 * GET confere um token secreto combinado no dashboard da Meta, e o POST
 * confere a assinatura HMAC do corpo (ver WhatsappService.verifySignature).
 */
@ApiExcludeController()
@Controller('whatsapp')
export class WhatsappController {
  private readonly logger = new Logger(WhatsappController.name);

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

  /**
   * Webhook da Twilio (WhatsApp Sandbox / sender próprio). A assinatura é
   * calculada sobre a URL pública exata configurada no console da Twilio —
   * por isso vem de TWILIO_WEBHOOK_URL, e não de req.protocol/host (atrás do
   * proxy do Render isso não bate). A resposta vai no corpo, como TwiML; usa
   * @Res() pra sair crua, já que o interceptor global embrulharia em JSON.
   */
  @Post('twilio')
  async receiveTwilioWebhook(
    @Headers('x-twilio-signature') signature: string,
    @Body() body: Record<string, string>,
    @Res() res: Response,
  ) {
    res.status(200).type('text/xml');

    if (!this.whatsappService.verifyTwilioSignature(process.env.TWILIO_WEBHOOK_URL, body, signature)) {
      this.logger.warn(
        `Assinatura Twilio inválida (TWILIO_WEBHOOK_URL=${process.env.TWILIO_WEBHOOK_URL ?? 'AUSENTE'}, ` +
          `TWILIO_AUTH_TOKEN=${process.env.TWILIO_AUTH_TOKEN ? 'definido' : 'AUSENTE'})`,
      );
      res.send(buildTwiml([]));
      return;
    }

    const replies = await this.whatsappService.handleTwilioPayload(body);
    res.send(buildTwiml(replies));
  }
}
