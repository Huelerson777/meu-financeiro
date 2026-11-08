import { TransactionsService } from './transactions.service';

const d = (s: string) => new Date(`${s}T12:00:00Z`);

function setup() {
  const tx = {
    transaction: { create: jest.fn(), update: jest.fn(), delete: jest.fn(), findFirst: jest.fn() },
    account: { update: jest.fn() },
    recurringBillSkip: { upsert: jest.fn() },
  };
  const prisma: any = {
    account: { findFirst: jest.fn().mockResolvedValue({ id: 'acc' }) },
    category: { findMany: jest.fn().mockResolvedValue([]) },
    transaction: { findMany: jest.fn() },
    $transaction: jest.fn(async (cb: any) => cb(tx)),
  };
  return { prisma, tx, service: new TransactionsService(prisma) };
}

describe('contas fixas x banco', () => {
  it('importFromBank baixa a conta fixa em aberto com o valor real, sem criar lançamento novo', async () => {
    const { prisma, tx, service } = setup();
    prisma.transaction.findMany
      .mockResolvedValueOnce([]) // externalIds já conhecidos
      .mockResolvedValueOnce([]) // histórico p/ categorias
      .mockResolvedValueOnce([{ id: 'p1', description: 'Energia', amount: 303.55, date: d('2026-11-10'), type: 'EXPENSE' }]);
    const r = await service.importFromBank('u', 'acc', [
      { externalId: 'pluggy:1', date: d('2026-11-06'), description: 'Pagamento para CELESC DISTRIBUICAO S.A', amount: -245.65 },
    ]);
    expect(r).toEqual({ created: 0, settledRecurring: 1 });
    expect(tx.transaction.create).not.toHaveBeenCalled();
    expect(tx.transaction.update).toHaveBeenCalledWith({
      where: { id: 'p1' },
      data: { status: 'PAID', amount: 245.65, date: d('2026-11-06'), accountId: 'acc', externalId: 'pluggy:1' },
    });
    expect(tx.account.update).toHaveBeenCalledTimes(1); // saldo mexe uma única vez
  });

  it('gasto comum continua virando lançamento novo', async () => {
    const { prisma, tx, service } = setup();
    prisma.transaction.findMany.mockResolvedValue([]);
    const r = await service.importFromBank('u', 'acc', [
      { externalId: 'pluggy:2', date: d('2026-11-06'), description: 'Pix enviado para Carolina', amount: -25 },
    ]);
    expect(r.created).toBe(1);
    expect(tx.transaction.create).toHaveBeenCalledTimes(1);
  });

  it('excluir o pendente de uma conta fixa registra o mês pulado', async () => {
    const { tx, service } = setup();
    tx.transaction.findFirst.mockResolvedValue({
      id: 't', type: 'EXPENSE', status: 'PENDING', accountId: 'acc', amount: 80, recurringBillId: 'r1', date: new Date('2026-11-10T00:00:00Z'),
    });
    await service.remove('t', 'u');
    expect(tx.recurringBillSkip.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { recurringBillId_month: { recurringBillId: 'r1', month: '2026-11' } } }),
    );
    expect(tx.transaction.delete).toHaveBeenCalled();
    expect(tx.account.update).not.toHaveBeenCalled();
  });

  it('funde conta fixa marcada à mão com o mesmo pagamento do banco e devolve o saldo duplicado', async () => {
    const { prisma, tx, service } = setup();
    const bank = { id: 'b1', accountId: 'acc', type: 'EXPENSE', amount: 245.65, date: d('2026-11-06'), description: 'Pagamento para CELESC DISTRIBUICAO S.A', categoryId: 'x', recurringBillId: null };
    const manual = { id: 'm1', accountId: 'acc', type: 'EXPENSE', amount: 245.65, date: d('2026-11-10'), description: 'Energia', categoryId: 'casa', recurringBillId: 'r1' };
    prisma.transaction.findMany.mockResolvedValueOnce([bank]).mockResolvedValueOnce([manual]);
    const r = await service.mergeManualRecurringWithBank('u');
    expect(r.merged).toBe(1);
    expect(tx.transaction.delete).toHaveBeenCalledWith({ where: { id: 'm1' } });
    expect(tx.transaction.update).toHaveBeenCalledWith({ where: { id: 'b1' }, data: { recurringBillId: 'r1', categoryId: 'casa' } });
    expect(tx.account.update).toHaveBeenCalledWith({ where: { id: 'acc' }, data: { currentBalance: { decrement: -245.65 } } });
  });

  it('não funde quando o valor difere mais de R$ 1 (outro mês)', async () => {
    const { prisma, tx, service } = setup();
    const bank = { id: 'b1', accountId: 'acc', type: 'EXPENSE', amount: 245.65, date: d('2026-11-06'), description: 'CELESC', categoryId: null, recurringBillId: null };
    const manual = { id: 'm1', accountId: 'acc', type: 'EXPENSE', amount: 303.55, date: d('2026-10-10'), description: 'Energia', categoryId: 'casa', recurringBillId: 'r1' };
    prisma.transaction.findMany.mockResolvedValueOnce([bank]).mockResolvedValueOnce([manual]);
    expect((await service.mergeManualRecurringWithBank('u')).merged).toBe(0);
    expect(tx.transaction.delete).not.toHaveBeenCalled();
  });
});
