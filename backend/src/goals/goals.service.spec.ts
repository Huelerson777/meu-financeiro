import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { GoalsService } from './goals.service';

describe('GoalsService', () => {
  const userId = 'u1';
  let prisma: any;
  let service: GoalsService;

  beforeEach(() => {
    prisma = {
      goal: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };
    service = new GoalsService(prisma);
  });

  it('create assume currentAmount 0 e converte deadline', async () => {
    prisma.goal.create.mockResolvedValue({});
    await service.create(userId, { name: 'Viagem', targetAmount: 5000, deadline: '2026-12-31' } as any);
    const data = prisma.goal.create.mock.calls[0][0].data;
    expect(data.currentAmount).toBe(0);
    expect(data.deadline).toBeInstanceOf(Date);
    expect(data.userId).toBe(userId);
  });

  it('findOne lança NotFound para meta de outro usuário', async () => {
    prisma.goal.findFirst.mockResolvedValue(null);
    await expect(service.findOne('g1', userId)).rejects.toThrow(NotFoundException);
  });

  it('contribute soma de forma atômica (increment) após checar o dono', async () => {
    prisma.goal.findUnique.mockResolvedValue({ id: 'g1', userId });
    prisma.goal.update.mockResolvedValue({});
    await service.contribute('g1', userId, { amount: 150 } as any);
    expect(prisma.goal.update).toHaveBeenCalledWith({
      where: { id: 'g1' },
      data: { currentAmount: { increment: 150 } },
    });
  });

  it('contribute/update/remove recusam meta de outro usuário', async () => {
    prisma.goal.findUnique.mockResolvedValue({ id: 'g1', userId: 'outro' });
    await expect(service.contribute('g1', userId, { amount: 1 } as any)).rejects.toThrow(ForbiddenException);
    await expect(service.update('g1', userId, {} as any)).rejects.toThrow(ForbiddenException);
    await expect(service.remove('g1', userId)).rejects.toThrow(ForbiddenException);
    expect(prisma.goal.update).not.toHaveBeenCalled();
    expect(prisma.goal.delete).not.toHaveBeenCalled();
  });

  it('meta inexistente vira NotFound', async () => {
    prisma.goal.findUnique.mockResolvedValue(null);
    await expect(service.remove('g1', userId)).rejects.toThrow(NotFoundException);
  });
});
