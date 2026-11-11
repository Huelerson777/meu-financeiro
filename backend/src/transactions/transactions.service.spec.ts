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

describe('TransactionsService — parcelas (cartão / parcelamento) pela rota genérica', () => {
  const userId = 'user-1';

  function build(existing: any) {
    const tx = {
      transaction: {
        findFirst: jest.fn().mockResolvedValue(existing),
        update: jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ ...existing, ...data })),
        delete: jest.fn(),
      },
      account: { update: jest.fn() },
      recurringBillSkip: { upsert: jest.fn() },
    };
    const prisma: any = {
      account: { findFirst: jest.fn().mockResolvedValue({ id: 'acc-1', userId }) },
      category: { findFirst: jest.fn().mockResolvedValue({ id: 'cat-1', userId }) },
      $transaction: jest.fn(async (cb: (t: typeof tx) => unknown) => cb(tx)),
    };
    return { service: new TransactionsService(prisma), tx };
  }

  const cardRow = {
    id: 't1', userId, cardId: 'card-1', isInstallment: true, accountId: null,
    type: 'EXPENSE', status: 'PAID', amount: 100, date: new Date('2026-11-17T00:00:00.000Z'), recurringBillId: null,
  };
  const financingRow = { ...cardRow, cardId: null, accountId: 'acc-1' };

  it('excluir compra de cartão por aqui é recusado (não devolveria limite nem o valor pago)', async () => {
    const { service, tx } = build(cardRow);
    await expect(service.remove('t1', userId)).rejects.toBeInstanceOf(ForbiddenException);
    expect(tx.transaction.delete).not.toHaveBeenCalled();
    expect(tx.account.update).not.toHaveBeenCalled();
  });

  it('excluir parcela de parcelamento por aqui também é recusado', async () => {
    const { service, tx } = build(financingRow);
    await expect(service.remove('t1', userId)).rejects.toBeInstanceOf(ForbiddenException);
    expect(tx.transaction.delete).not.toHaveBeenCalled();
  });

  it('mudar valor ou status de parcela é recusado e não toca no saldo', async () => {
    const { service, tx } = build(cardRow);
    await expect(service.update('t1', userId, { amount: 150 } as any)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.update('t1', userId, { status: 'PENDING' } as any)).rejects.toBeInstanceOf(ForbiddenException);
    expect(tx.transaction.update).not.toHaveBeenCalled();
    expect(tx.account.update).not.toHaveBeenCalled();
  });

  it('categorizar/renomear parcela passa, sem debitar conta nem gravar accountId', async () => {
    const { service, tx } = build(cardRow);
    // É o que o formulário de Transações manda: todos os campos, com uma conta escolhida.
    await service.update('t1', userId, {
      description: 'Tênis (1/3)', categoryId: 'cat-1', amount: 100, type: 'EXPENSE', status: 'PAID', accountId: 'acc-1',
      date: '2026-11-17T12:00:00.000Z',
    } as any);

    expect(tx.transaction.update).toHaveBeenCalledWith({
      where: { id: 't1' },
      data: { description: 'Tênis (1/3)', categoryId: 'cat-1', notes: undefined },
    });
    expect(tx.account.update).not.toHaveBeenCalled();
  });

  it('transação comum continua editável e ajusta o saldo normalmente', async () => {
    const plain = { ...cardRow, cardId: null, isInstallment: false, accountId: 'acc-1' };
    const { service, tx } = build(plain);
    await service.update('t1', userId, { amount: 150 } as any);
    // reverte 100 e reaplica 150 na mesma conta
    expect(tx.account.update).toHaveBeenCalledTimes(2);
  });
});
