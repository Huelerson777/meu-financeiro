import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { RecurringBillsService } from './recurring-bills.service';

describe('RecurringBillsService', () => {
  const userId = 'u1';
  let prisma: any;
  let service: RecurringBillsService;

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 1, 10)); // fevereiro/2026 (28 dias)
    prisma = {
      recurringBill: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      transaction: { findFirst: jest.fn(), create: jest.fn(), updateMany: jest.fn() },
      category: { findFirst: jest.fn() },
      account: { findFirst: jest.fn() },
    };
    service = new RecurringBillsService(prisma);
  });

  afterEach(() => jest.useRealTimers());

  it('create recusa categoria/conta de outro usuário', async () => {
    prisma.category.findFirst.mockResolvedValue(null);
    await expect(
      service.create(userId, { description: 'Luz', dueDay: 5, categoryId: 'c' } as any),
    ).rejects.toThrow(ForbiddenException);
    prisma.category.findFirst.mockResolvedValue({ id: 'c' });
    prisma.account.findFirst.mockResolvedValue(null);
    await expect(
      service.create(userId, { description: 'Luz', dueDay: 5, categoryId: 'c', accountId: 'a' } as any),
    ).rejects.toThrow(ForbiddenException);
    expect(prisma.recurringBill.create).not.toHaveBeenCalled();
  });

  it('create usa EXPENSE e ativo como padrão', async () => {
    prisma.recurringBill.create.mockResolvedValue({});
    await service.create(userId, { description: 'Luz', dueDay: 5 } as any);
    const data = prisma.recurringBill.create.mock.calls[0][0].data;
    expect(data.type).toBe('EXPENSE');
    expect(data.isActive).toBe(true);
  });

  it('update propaga valor só para lançamentos PENDING', async () => {
    prisma.recurringBill.findFirst.mockResolvedValue({ id: 'r1' });
    prisma.recurringBill.update.mockResolvedValue({ id: 'r1' });
    await service.update('r1', userId, { defaultAmount: 99 } as any);
    expect(prisma.transaction.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { recurringBillId: 'r1', status: 'PENDING' },
        data: expect.objectContaining({ amount: 99 }),
      }),
    );
  });

  it('remove lança NotFound se não for do usuário', async () => {
    prisma.recurringBill.findFirst.mockResolvedValue(null);
    await expect(service.remove('r1', userId)).rejects.toThrow(NotFoundException);
  });

  describe('sync', () => {
    it('gera lançamento do mês e limita o dia de vencimento ao último dia', async () => {
      prisma.recurringBill.findMany.mockResolvedValue([
        { id: 'r1', description: 'Aluguel', dueDay: 31, defaultAmount: 1200, type: 'EXPENSE', accountId: 'a', categoryId: 'c' },
      ]);
      prisma.transaction.findFirst.mockResolvedValue(null);
      const result = await service.sync(userId);
      expect(result).toEqual({ generated: 1 });
      const data = prisma.transaction.create.mock.calls[0][0].data;
      expect(data.date).toEqual(new Date(2026, 1, 28));
      expect(data.status).toBe('PENDING');
      expect(data.amount).toBe(1200);
    });

    it('é idempotente: não duplica se o mês já tem lançamento', async () => {
      prisma.recurringBill.findMany.mockResolvedValue([{ id: 'r1', dueDay: 5, defaultAmount: 10 }]);
      prisma.transaction.findFirst.mockResolvedValue({ id: 't' });
      expect(await service.sync(userId)).toEqual({ generated: 0 });
      expect(prisma.transaction.create).not.toHaveBeenCalled();
    });

    it('sem valor padrão usa o último valor pago (ou 0)', async () => {
      prisma.recurringBill.findMany.mockResolvedValue([{ id: 'r1', dueDay: 5, defaultAmount: null, type: 'EXPENSE' }]);
      prisma.transaction.findFirst
        .mockResolvedValueOnce(null) // já gerado?
        .mockResolvedValueOnce({ amount: '87.9' }); // último pago
      await service.sync(userId);
      expect(prisma.transaction.create.mock.calls[0][0].data.amount).toBe(87.9);
    });
  });
});
