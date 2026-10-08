import { Body, Controller, Headers, HttpCode, Logger, Post, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { timingSafeEqual } from 'crypto';
import { OpenFinanceService } from './open-finance.service';

/**
 * Webhook da Pluggy: quando um item termina de atualizar, sincroniza as conexões dele.
 * Não usa JwtAuthGuard (quem chama é a Pluggy); a autenticação é um segredo no header
 * `x-webhook-secret`, registrado junto com o webhook (campo `headers` do POST /webhooks).
 */
@Controller('open-finance/webhook')
export class OpenFinanceWebhookController {
  private readonly logger = new Logger(OpenFinanceWebhookController.name);

  constructor(private readonly service: OpenFinanceService) {}

  @Post()
  @HttpCode(200)
  receive(@Headers('x-webhook-secret') secret: string | undefined, @Body() body: { event?: string; itemId?: string }) {
    const expected = process.env.PLUGGY_WEBHOOK_SECRET;
    if (!expected) throw new ServiceUnavailableException('Webhook do Open Finance não configurado');
    if (!secret || !safeEqual(secret, expected)) throw new UnauthorizedException();

    // A Pluggy espera 2xx em até 10s: responde já e sincroniza em segundo plano.
    if (body?.event === 'item/updated' && typeof body.itemId === 'string') {
      this.service.syncByItem(body.itemId).catch((err) => this.logger.error(`Falha ao sincronizar pelo webhook: ${err?.message}`));
    }
    return { received: true };
  }
}

function safeEqual(a: string, b: string) {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}
