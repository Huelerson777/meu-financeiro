import { ForbiddenException } from '@nestjs/common';
import { TransactionsService } from './transactions.service';

type Mock = jest.Mock;

function makePrisma() {
  const tx = {
    transaction: { create: jest.fn() },
    account: { update: jest.fn() },
  };
  const prisma: any = {
    account: { findFirst: jest.fn() },
    category: { findMany: jest.fn(), count: jest.fn(), findFirst: jest.fn() },
    transaction: { findMany: jest.fn(), count: jest.fn() },
    $transaction: jest.fn(async (cb: (t: typeof tx) => unknown) => cb(tx)),
  };
  return { prisma, tx };
}

describe('TransactionsService', () => {
  const userId = 'user-1';
  let prisma: ReturnType<typeof makePrisma>['prisma'];
  let tx: ReturnType<typeof makePrisma>['tx'];
  let service: TransactionsService;

  beforeEach(() => {
    ({ prisma, tx } = makePrisma());
    prisma.account.findFirst.mockResolvedValue({ id: 'acc-1', userId });
    service = new TransactionsService(prisma);
  });

  describe('findAll — ordem pela data efetiva', () => {
    it('parcela paga conta pela data do pagamento, não pelo vencimento', async () => {
      prisma.transaction.count.mockResolvedValue(3);
      prisma.transaction.findMany
        .mockResolvedValueOnce([
          // lançamento comum de 05/10
          { id: 'a', date: new Date('2026-10-05T12:00:00Z'), installments: [] },
          // parcela com vencimento antigo (01/08) mas paga em 06/10 -> deve ir ao topo
          { id: 'b', date: new Date('2026-08-01T12:00:00Z'), installments: [{ paid: true, paidAt: new Date('2026-10-06T12:00:00Z') }] },
          // parcela não paga: vale o vencimento (03/10)
          { id: 'c', date: new Date('2026-10-03T12:00:00Z'), installments: [{ paid: false, paidAt: null }] },
        ])
        .mockImplementationOnce(async ({ where }: any) => where.id.in.map((id: string) => ({ id })));

      const result = await service.findAll(userId, {});

      expect(result.items.map((i: any) => i.id)).toEqual(['b', 'a', 'c']);
      expect(result.meta.total).toBe(3);
    });
  });
});
