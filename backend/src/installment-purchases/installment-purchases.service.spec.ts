import { BadRequestException, NotFoundException } from '@nestjs/common';
import { InstallmentPurchasesService } from './installment-purchases.service';

describe('InstallmentPurchasesService', () => {
  const userId = 'u1';
  let tx: any;
  let prisma: any;
  let service: InstallmentPurchasesService;

  beforeEach(() => {
    tx = {
      transaction: { createMany: jest.fn(), deleteMany: jest.fn() },
      installment: { createMany: jest.fn() },
      account: { update: jest.fn() },
    };
    prisma = {
      $transaction: jest.fn((fn: any) => fn(tx)),
      transaction: { findMany: jest.fn() },
      category: { findFirst: jest.fn() },
      account: { findFirst: jest.fn() },
    };
    service = new InstallmentPurchasesService(prisma);
  });

  const dto = (over: any = {}) => ({
    description: 'Geladeira',
    installmentAmount: 100,
    totalInstallments: 3,
    firstDueDate: '2026-01-31',
    ...over,
  });

  it('recusa parcela inicial maior que o total', async () => {
    await expect(service.create(userId, dto({ startInstallment: 4 }) as any)).rejects.toThrow(BadRequestException);
  });

  it('cria N parcelas numeradas, com vencimento mensal sem estourar o fim do mês', async () => {
    await service.create(userId, dto() as any);
    const rows = tx.transaction.createMany.mock.calls[0][0].data;
    expect(rows.map((r: any) => r.description)).toEqual([
      'Geladeira (1/3)',
      'Geladeira (2/3)',
      'Geladeira (3/3)',
    ]);
    // 31/jan -> 28/fev -> 31/mar (sem virar 03/mar)
    expect(rows.map((r: any) => r.date.toISOString().slice(0, 10))).toEqual([
      '2026-01-31',
      '2026-02-28',
      '2026-03-31',
    ]);
    expect(tx.installment.createMany.mock.calls[0][0].data).toHaveLength(3);
  });

  it('startInstallment pula as parcelas já pagas fora do sistema', async () => {
    await service.create(userId, dto({ startInstallment: 2 }) as any);
    const rows = tx.transaction.createMany.mock.calls[0][0].data;
    expect(rows.map((r: any) => r.description)).toEqual(['Geladeira (2/3)', 'Geladeira (3/3)']);
  });

  it('remove devolve às contas o valor das parcelas pagas e apaga o grupo', async () => {
    prisma.transaction.findMany.mockResolvedValue([
      { installments: [{ paid: true, paidFromAccountId: 'a1', amount: 100 }] },
      { installments: [{ paid: true, paidFromAccountId: 'a1', amount: 100 }] },
      { installments: [{ paid: false, paidFromAccountId: null, amount: 100 }] },
    ]);
    const result = await service.remove('g1', userId);
    expect(tx.account.update).toHaveBeenCalledTimes(1);
    expect(tx.account.update).toHaveBeenCalledWith({
      where: { id: 'a1' },
      data: { currentBalance: { increment: 200 } },
    });
    expect(tx.transaction.deleteMany).toHaveBeenCalledWith({ where: { installmentGroupId: 'g1', userId } });
    expect(result).toEqual({ deleted: 3 });
  });

  it('remove/update de grupo inexistente lança NotFound', async () => {
    prisma.transaction.findMany.mockResolvedValue([]);
    await expect(service.remove('g1', userId)).rejects.toThrow(NotFoundException);
    await expect(service.update('g1', userId, dto() as any)).rejects.toThrow(NotFoundException);
  });

  it('findAll agrupa, tira o sufixo (n/m) e conta parcelas anteriores ao rastreio como pagas', async () => {
    const t = (id: string, number: number, paid: boolean, date: Date) => ({
      id,
      description: `Carro (${number}/6)`,
      category: null,
      categoryId: null,
      account: null,
      accountId: null,
      amount: 500,
      date,
      installmentGroupId: 'g1',
      installments: [{ id: `i${number}`, number, totalCount: 6, paid, paidAt: null }],
    });
    prisma.transaction.findMany.mockResolvedValue([
      t('t5', 5, true, new Date(2026, 4, 1)),
      t('t6', 6, false, new Date(2026, 5, 1)),
    ]);
    const [g] = await service.findAll(userId);
    expect(g.description).toBe('Carro');
    expect(g.paidCount).toBe(5); // 4 anteriores ao rastreio + 1 paga
    expect(g.remainingCount).toBe(1);
    expect(g.nextDueDate).toEqual(new Date(2026, 5, 1));
  });
});
