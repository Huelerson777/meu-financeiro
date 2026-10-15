import { CardsService } from './cards.service';

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
      const d = service.parseDateOnly('2026-03-01');
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
