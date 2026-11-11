import { CardsService } from './cards.service';
import { parseDateOnly } from '../common/utils/date-only';

describe('CardsService — regras puras', () => {
  const service = new CardsService({} as any) as any;

  describe('splitAmount', () => {
    it('divide igualmente quando exato', () => {
      expect(service.splitAmount(300, 3)).toEqual([100, 100, 100]);
    });

    it('joga o resto de centavos na última parcela e soma o total', () => {
      const parts = service.splitAmount(100, 3);
      expect(parts).toEqual([33.33, 33.33, 33.34]);
      expect(Math.round(parts.reduce((a: number, b: number) => a + b, 0) * 100) / 100).toBe(100);
    });
  });

  describe('calculateInstallmentDueDate', () => {
    it('compra antes do fechamento cai na fatura do mês (vence no mesmo mês se dueDay >= closingDay)', () => {
      const due = service.calculateInstallmentDueDate(new Date(2026, 0, 2), 3, 10, 0);
      expect(due).toEqual(new Date(2026, 0, 10));
    });

    it('compra no dia do fechamento ou depois vai para o ciclo seguinte', () => {
      const due = service.calculateInstallmentDueDate(new Date(2026, 0, 3), 3, 10, 0);
      expect(due).toEqual(new Date(2026, 1, 10));
    });

    it('vencimento antes do fechamento cai no mês seguinte ao ciclo', () => {
      const due = service.calculateInstallmentDueDate(new Date(2026, 0, 10), 27, 3, 0);
      expect(due).toEqual(new Date(2026, 1, 3));
    });

    it('vencimento dia 31 não transborda em mês curto', () => {
      // fecha dia 5, vence dia 31: compra em 02/jan -> ciclo jan; parcela 1 em fevereiro vence 28/fev
      expect(service.calculateInstallmentDueDate(new Date(2026, 0, 2), 5, 31, 1)).toEqual(new Date(2026, 1, 28));
      expect(service.calculateInstallmentDueDate(new Date(2026, 0, 2), 5, 31, 3)).toEqual(new Date(2026, 3, 30));
    });

    it('cada parcela cai um mês depois, virando o ano', () => {
      const due = service.calculateInstallmentDueDate(new Date(2026, 10, 20), 5, 12, 2);
      expect(due).toEqual(new Date(2027, 1, 12));
    });
  });

  describe('computeRecurringDueDate', () => {
    it('limita o dia de cobrança ao último dia do mês', () => {
      const due = service.computeRecurringDueDate({ closingDay: 25, dueDay: 28 }, 31, new Date(2026, 1, 10));
      // 28/fev (limite) ainda é >= fechamento 25 → próximo ciclo, vence 28/mar
      expect(due).toEqual(new Date(2026, 2, 28));
    });
  });

  describe('parseDateOnly', () => {
    it('interpreta YYYY-MM-DD como dia local (sem deslocar o mês no dia 1º)', () => {
      const d = parseDateOnly('2026-03-01');
      expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2026, 2, 1]);
    });
  });

  describe('getInvoices', () => {
    const tx = (over: any) => ({
      id: 't', description: 'x', amount: 100, date: new Date(2026, 0, 10), purchaseDate: new Date(2026, 0, 2),
      createdAt: new Date(2026, 0, 2), category: null, categoryId: null, installmentGroupId: null,
      isInstallment: true, cardRecurringPurchaseId: null, installments: [{ id: 'i', paid: false, paidAt: null, paidFromAccount: null }],
      ...over,
    });

    it('agrupa por mês, soma total e em aberto, e marca estornos', async () => {
      const prisma: any = {
        card: { findUnique: jest.fn().mockResolvedValue({ id: 'c', userId: 'u' }) },
        transaction: {
          findMany: jest.fn().mockResolvedValue([
            tx({ id: 'a', amount: 100 }),
            tx({ id: 'b', amount: 50, installments: [{ id: 'j', paid: true, paidAt: new Date(), paidFromAccount: { name: 'Conta' } }] }),
            tx({ id: 'c', amount: -20, isInstallment: false, installments: [] }),
            tx({ id: 'd', amount: 70, date: new Date(2026, 1, 10) }),
          ]),
        },
      };
      const svc = new CardsService(prisma);
      const invoices = await svc.getInvoices('c', 'u');
      expect(invoices.map((i) => i.month)).toEqual(['2026-01', '2026-02']);
      expect(invoices[0].total).toBe(130);
      expect(invoices[0].openTotal).toBe(80);
      expect(invoices[0].items.find((i) => i.id === 'c')!.isCredit).toBe(true);
      expect(invoices[1].openTotal).toBe(70);
    });
  });
});

describe('CardsService — updatePurchase em compra sem installmentGroupId', () => {
  // Compra à vista importada do banco (Open Finance): não tem grupo, o
  // identificador que o frontend manda é o id da própria transação.
  function build() {
    const tx = {
      account: { update: jest.fn() },
      transaction: {
        deleteMany: jest.fn(),
        create: jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: 'new-1', ...data })),
      },
      installment: { create: jest.fn() },
      card: { update: jest.fn() },
    };
    const original = {
      id: 't1',
      cardId: 'c1',
      amount: 100,
      installmentGroupId: null,
      externalId: 'pluggy:abc',
      cardRecurringPurchaseId: null,
      installments: [{ paid: false, paidFromAccountId: null, amount: 100 }],
    };
    const prisma: any = {
      transaction: {
        findMany: jest
          .fn()
          .mockResolvedValueOnce([]) // busca pelo grupo: nada
          .mockResolvedValueOnce([original]), // busca pelo id
      },
      card: {
        findUnique: jest.fn().mockResolvedValue({ id: 'c1', userId: 'u1', limitAmount: 1000, usedLimit: 100, closingDay: 10, dueDay: 17 }),
      },
      $transaction: jest.fn(async (cb: (t: typeof tx) => unknown) => cb(tx)),
    };
    return { service: new CardsService(prisma), tx };
  }

  it('apaga a transação original pelo id (antes sobrava e a compra duplicava)', async () => {
    const { service, tx } = build();
    await service.updatePurchase('t1', 'u1', {
      description: 'Mercado',
      totalAmount: 120,
      installmentsCount: 1,
      purchaseDate: '2026-11-05',
    } as any);

    expect(tx.transaction.deleteMany).toHaveBeenCalledWith({ where: { id: { in: ['t1'] }, userId: 'u1' } });
    expect(tx.transaction.create).toHaveBeenCalledTimes(1);
    expect(tx.card.update).toHaveBeenCalledWith({ where: { id: 'c1' }, data: { usedLimit: { increment: 20 } } });
  });

  it('mantém o externalId na compra recriada, pra próxima sincronização não reimportar', async () => {
    const { service, tx } = build();
    await service.updatePurchase('t1', 'u1', {
      description: 'Mercado',
      totalAmount: 120,
      installmentsCount: 2,
      purchaseDate: '2026-11-05',
    } as any);

    const created = tx.transaction.create.mock.calls.map(([arg]: any) => arg.data);
    expect(created).toHaveLength(2);
    expect(created[0].externalId).toBe('pluggy:abc');
    expect(created[1].externalId).toBeUndefined();
  });
});

describe('CardsService — syncRecurringPurchases', () => {
  it('duas sincronizações simultâneas geram a cobrança do mês uma vez só', async () => {
    let generated = false;
    const tx = {
      transaction: { create: jest.fn().mockImplementation(() => { generated = true; return Promise.resolve({ id: 'occ-1' }); }) },
      installment: { create: jest.fn() },
      card: { update: jest.fn() },
    };
    const recurring = {
      id: 'r1', userId: 'u1', cardId: 'c1', categoryId: null, description: 'Streaming', amount: 30, chargeDay: 5,
      card: { id: 'c1', isArchived: false, closingDay: 10, dueDay: 17 },
    };
    const prisma: any = {
      cardRecurringPurchase: { findMany: jest.fn().mockResolvedValue([recurring]) },
      transaction: {
        // "já gerou este mês?" — responde depois de um tempinho, como o banco real.
        findFirst: jest.fn().mockImplementation(async () => {
          await new Promise((resolve) => setTimeout(resolve, 5));
          return generated ? { id: 'occ-1' } : null;
        }),
      },
      $transaction: jest.fn(async (cb: (t: typeof tx) => unknown) => cb(tx)),
    };
    const service = new CardsService(prisma);

    const results = await Promise.all([service.syncRecurringPurchases('u1'), service.syncRecurringPurchases('u1')]);

    expect(tx.transaction.create).toHaveBeenCalledTimes(1);
    expect(tx.card.update).toHaveBeenCalledTimes(1);
    expect(results).toEqual([{ generated: 1 }, { generated: 1 }]);
  });
});

describe('CardsService — pagamento de parcela (duplo clique / duas abas)', () => {
  // Simula o banco: a parcela só pode ser marcada como paga uma vez, e a
  // transação inteira é desfeita se o callback lançar erro.
  function build() {
    const state = { paid: false, balance: 1000 };
    const prisma: any = {
      installment: {
        findUnique: jest.fn().mockImplementation(async () => ({
          id: 'i1', transactionId: 't1', amount: 100, paid: state.paid, paidFromAccountId: state.paid ? 'acc-1' : null,
          transaction: { userId: 'u1', description: 'Tênis (1/3)' },
        })),
        findMany: jest.fn().mockImplementation(async () => [
          { id: 'i1', transactionId: 't1', amount: 100, paid: state.paid, transaction: { userId: 'u1' } },
        ]),
      },
      account: { findFirst: jest.fn().mockResolvedValue({ id: 'acc-1', userId: 'u1' }) },
      card: { findUnique: jest.fn().mockResolvedValue({ id: 'c1', userId: 'u1' }) },
      transaction: { findMany: jest.fn().mockResolvedValue([]) },
      $transaction: jest.fn(async (cb: (t: any) => unknown) => {
        // Rollback desfaz só o que ESTA transação fez (não o que a outra já gravou).
        const undo: (() => void)[] = [];
        const tx = {
          account: {
            update: jest.fn(async ({ data }: any) => {
              const delta = Number(data.currentBalance.increment ?? 0) - Number(data.currentBalance.decrement ?? 0);
              state.balance += delta;
              undo.push(() => { state.balance -= delta; });
            }),
          },
          transaction: { update: jest.fn(), updateMany: jest.fn() },
          installment: {
            updateMany: jest.fn(async ({ where, data }: any) => {
              if (where.paid !== undefined && where.paid !== state.paid) return { count: 0 };
              const previous = state.paid;
              state.paid = data.paid;
              undo.push(() => { state.paid = previous; });
              return { count: 1 };
            }),
            findUniqueOrThrow: jest.fn(async () => ({ id: 'i1', paid: state.paid })),
          },
        };
        try {
          return await cb(tx);
        } catch (error) {
          undo.reverse().forEach((revert) => revert());
          throw error;
        }
      }),
    };
    return { service: new CardsService(prisma), state };
  }

  it('duas requisições ao mesmo tempo debitam a conta uma vez só', async () => {
    const { service, state } = build();

    const results = await Promise.allSettled([
      service.payInstallment('i1', 'u1', { accountId: 'acc-1' } as any),
      service.payInstallment('i1', 'u1', { accountId: 'acc-1' } as any),
    ]);

    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((r) => r.status === 'rejected')).toHaveLength(1);
    expect(state.balance).toBe(900);
    expect(state.paid).toBe(true);
  });

  it('pagar em lote e pagar a fatura também não cobram duas vezes', async () => {
    const batch = build();
    await Promise.allSettled([
      batch.service.payInstallmentsBatch('u1', { installmentIds: ['i1'], accountId: 'acc-1' } as any),
      batch.service.payInstallmentsBatch('u1', { installmentIds: ['i1'], accountId: 'acc-1' } as any),
    ]);
    expect(batch.state.balance).toBe(900);

    const invoice = build();
    await Promise.allSettled([
      invoice.service.payInvoice('c1', 'u1', { accountId: 'acc-1', month: '2026-11' } as any),
      invoice.service.payInvoice('c1', 'u1', { accountId: 'acc-1', month: '2026-11' } as any),
    ]);
    expect(invoice.state.balance).toBe(900);
  });

  it('desfazer o pagamento duas vezes devolve o valor uma vez só', async () => {
    const { service, state } = build();
    await service.payInstallment('i1', 'u1', { accountId: 'acc-1' } as any);
    expect(state.balance).toBe(900);

    await Promise.allSettled([service.unpayInstallment('i1', 'u1'), service.unpayInstallment('i1', 'u1')]);

    expect(state.balance).toBe(1000);
    expect(state.paid).toBe(false);
  });
});
