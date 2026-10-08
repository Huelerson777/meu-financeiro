import { ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { OpenFinanceWebhookController } from './open-finance.webhook.controller';

describe('OpenFinanceWebhookController', () => {
  const original = process.env.PLUGGY_WEBHOOK_SECRET;
  let service: { syncByItem: jest.Mock };
  let controller: OpenFinanceWebhookController;

  beforeEach(() => {
    process.env.PLUGGY_WEBHOOK_SECRET = 'segredo-de-teste';
    service = { syncByItem: jest.fn().mockResolvedValue(undefined) };
    controller = new OpenFinanceWebhookController(service as any);
  });

  afterAll(() => {
    if (original === undefined) delete process.env.PLUGGY_WEBHOOK_SECRET;
    else process.env.PLUGGY_WEBHOOK_SECRET = original;
  });

  it('sincroniza o item quando chega item/updated com o segredo certo', () => {
    expect(controller.receive('segredo-de-teste', { event: 'item/updated', itemId: 'item-1' })).toEqual({ received: true });
    expect(service.syncByItem).toHaveBeenCalledWith('item-1');
  });

  it('rejeita segredo errado ou ausente sem sincronizar', () => {
    expect(() => controller.receive('errado', { event: 'item/updated', itemId: 'item-1' })).toThrow(UnauthorizedException);
    expect(() => controller.receive(undefined, { event: 'item/updated', itemId: 'item-1' })).toThrow(UnauthorizedException);
    expect(service.syncByItem).not.toHaveBeenCalled();
  });

  it('responde 503 quando o segredo não está configurado no servidor', () => {
    delete process.env.PLUGGY_WEBHOOK_SECRET;
    expect(() => controller.receive('qualquer', { event: 'item/updated', itemId: 'item-1' })).toThrow(ServiceUnavailableException);
  });

  it('ignora outros eventos', () => {
    expect(controller.receive('segredo-de-teste', { event: 'item/error', itemId: 'item-1' })).toEqual({ received: true });
    expect(service.syncByItem).not.toHaveBeenCalled();
  });
});
