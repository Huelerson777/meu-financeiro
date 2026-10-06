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

  describe('previewImport', () => {
    it('marca como duplicata só o que já existe: 2 linhas iguais no arquivo e 1 no banco marcam apenas a primeira', async () => {
      prisma.transaction.findMany
        .mockResolvedValueOnce([{ date: new Date('2026-10-03T12:00:00Z'), amount: 48.9, type: 'EXPENSE' }]) // existentes
        .mockResolvedValueOnce([]); // histórico p/ sugestão
      prisma.category.findMany.mockResolvedValue([]);

      const result = await service.previewImport(userId, {
        accountId: 'acc-1',
        rows: [
          { date: '2026-10-03', description: 'IFOOD', amount: -48.9 },
          { date: '2026-10-03', description: 'IFOOD', amount: -48.9 },
          { date: '2026-10-03', description: 'SALARIO', amount: 48.9 }, // sentido diferente: não é duplicata
        ],
      });

      expect(result.map((r) => r.duplicate)).toEqual([true, false, false]);
    });

    it('sugere categoria pelo histórico do usuário e cai nas palavras-chave quando não há histórico', async () => {
      prisma.transaction.findMany
        .mockResolvedValueOnce([]) // existentes
        .mockResolvedValueOnce([{ description: 'Padaria Estrela', categoryId: 'cat-food' }]); // histórico
      prisma.category.findMany.mockResolvedValue([
        { id: 'cat-food', name: 'Alimentação' },
        { id: 'cat-carro', name: 'Carro' },
      ]);

      const result = await service.previewImport(userId, {
        accountId: 'acc-1',
        rows: [
          { date: '2026-10-03', description: 'padaria estrela compra', amount: -20 },
          { date: '2026-10-03', description: 'Uber *viagem', amount: -15 },
          { date: '2026-10-03', description: 'ZZZ desconhecido', amount: -9 },
        ],
      });

      expect(result[0].categoryId).toBe('cat-food'); // histórico
      expect(result[1].categoryId).toBe('cat-carro'); // palavra-chave "uber" -> Carro
      expect(result[2].categoryId).toBeNull();
    });

    it('recusa conta de outro usuário', async () => {
      prisma.account.findFirst.mockResolvedValue(null);
      await expect(
        service.previewImport(userId, { accountId: 'acc-x', rows: [{ date: '2026-10-03', description: 'x', amount: -1 }] }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('importTransactions', () => {
    const baseRow = { date: '2026-10-03', description: '  Mercado ', amount: 10 };

    it('grava como PAID e ajusta o saldo: entrada soma, saída subtrai', async () => {
      tx.transaction.create.mockImplementation(async ({ data }: any) => ({ ...data, id: 'new', accountId: data.accountId }));
      prisma.category.count.mockResolvedValue(1);

      const result = await service.importTransactions(userId, {
        accountId: 'acc-1',
        rows: [
          { ...baseRow, type: 'EXPENSE', categoryId: 'cat-1' },
          { ...baseRow, description: 'Salário', amount: 100, type: 'INCOME' },
        ],
      });

      expect(result).toEqual({ created: 2 });
      expect(tx.transaction.create).toHaveBeenCalledTimes(2);
      expect((tx.transaction.create as Mock).mock.calls[0][0].data).toMatchObject({
        userId, accountId: 'acc-1', status: 'PAID', type: 'EXPENSE', description: 'Mercado', categoryId: 'cat-1',
      });
      expect(tx.account.update).toHaveBeenNthCalledWith(1, { where: { id: 'acc-1' }, data: { currentBalance: { decrement: 10 } } });
      expect(tx.account.update).toHaveBeenNthCalledWith(2, { where: { id: 'acc-1' }, data: { currentBalance: { increment: 100 } } });
    });

    it('recusa categoria que não pertence ao usuário e não grava nada', async () => {
      prisma.category.count.mockResolvedValue(0);
      await expect(
        service.importTransactions(userId, { accountId: 'acc-1', rows: [{ ...baseRow, type: 'EXPENSE', categoryId: 'cat-alheia' }] }),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });

});
