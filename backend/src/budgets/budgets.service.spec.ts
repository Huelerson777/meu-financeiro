import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { BudgetsService } from './budgets.service';

describe('BudgetsService', () => {
  const userId = 'u1';
  let prisma: any;
  let service: BudgetsService;

  beforeEach(() => {
    prisma = {
      budget: {
        findMany: jest.fn(),
        upsert: jest.fn(),
        findFirst: jest.fn(),
        delete: jest.fn(),
        createMany: jest.fn(),
      },
      category: { findFirst: jest.fn() },
    };
    service = new BudgetsService(prisma);
  });

  it('findAll converte amount (Decimal) para number', async () => {
    prisma.budget.findMany.mockResolvedValue([
      { id: 'b1', categoryId: 'c1', category: { name: 'Mercado' }, month: 3, year: 2026, amount: '350.50' },
    ]);
    const [b] = await service.findAll(userId, 3, 2026);
    expect(b.amount).toBe(350.5);
    expect(prisma.budget.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId, month: 3, year: 2026 } }),
    );
  });

  it('upsert recusa categoria de outro usuário', async () => {
    prisma.category.findFirst.mockResolvedValue(null);
    await expect(service.upsert(userId, { categoryId: 'x', month: 1, year: 2026, amount: 10 })).rejects.toThrow(
      ForbiddenException,
    );
    expect(prisma.budget.upsert).not.toHaveBeenCalled();
  });

  it('upsert cria/atualiza pela chave composta', async () => {
    prisma.category.findFirst.mockResolvedValue({ id: 'c1' });
    prisma.budget.upsert.mockResolvedValue({ id: 'b1', categoryId: 'c1', month: 1, year: 2026, amount: '100' });
    const result = await service.upsert(userId, { categoryId: 'c1', month: 1, year: 2026, amount: 100 });
    expect(result.amount).toBe(100);
    expect(prisma.budget.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId_categoryId_month_year: { userId, categoryId: 'c1', month: 1, year: 2026 } },
        update: { amount: 100 },
      }),
    );
  });

  it('remove lança NotFound se o orçamento não é do usuário', async () => {
    prisma.budget.findFirst.mockResolvedValue(null);
    await expect(service.remove('b1', userId)).rejects.toThrow(NotFoundException);
    expect(prisma.budget.delete).not.toHaveBeenCalled();
  });

  it('copyFromPrevious usa o mês anterior (virando o ano) e ignora duplicados', async () => {
    prisma.budget.findMany.mockResolvedValue([{ categoryId: 'c1', amount: 200 }]);
    prisma.budget.createMany.mockResolvedValue({ count: 1 });
    const result = await service.copyFromPrevious(userId, 1, 2026);
    expect(prisma.budget.findMany).toHaveBeenCalledWith({ where: { userId, month: 12, year: 2025 } });
    expect(prisma.budget.createMany).toHaveBeenCalledWith({
      data: [{ userId, categoryId: 'c1', month: 1, year: 2026, amount: 200 }],
      skipDuplicates: true,
    });
    expect(result).toEqual({ copied: 1 });
  });
});
