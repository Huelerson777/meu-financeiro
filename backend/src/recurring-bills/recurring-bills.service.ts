import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateRecurringBillDto } from './dto/create-recurring-bill.dto';
import { UpdateRecurringBillDto } from './dto/update-recurring-bill.dto';

@Injectable()
export class RecurringBillsService {
  constructor(private prisma: PrismaService) {}

  findAll(userId: string) {
    return this.prisma.recurringBill.findMany({
      where: { userId },
      include: { category: { select: { name: true, color: true } }, account: { select: { name: true } } },
      orderBy: [{ isActive: 'desc' }, { description: 'asc' }],
    });
  }

  async create(userId: string, dto: CreateRecurringBillDto) {
    if (dto.categoryId) await this.ensureCategoryOwnership(dto.categoryId, userId);
    if (dto.accountId) await this.ensureAccountOwnership(dto.accountId, userId);

    return this.prisma.recurringBill.create({
      data: {
        userId,
        description: dto.description,
        categoryId: dto.categoryId,
        accountId: dto.accountId,
        defaultAmount: dto.defaultAmount,
        dueDay: dto.dueDay,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async update(id: string, userId: string, dto: UpdateRecurringBillDto) {
    const existing = await this.prisma.recurringBill.findFirst({ where: { id, userId } });
    if (!existing) throw new NotFoundException('Conta fixa não encontrada');

    if (dto.categoryId) await this.ensureCategoryOwnership(dto.categoryId, userId);
    if (dto.accountId) await this.ensureAccountOwnership(dto.accountId, userId);

    return this.prisma.recurringBill.update({
      where: { id },
      data: {
        description: dto.description,
        categoryId: dto.categoryId,
        accountId: dto.accountId,
        defaultAmount: dto.defaultAmount,
        dueDay: dto.dueDay,
        isActive: dto.isActive,
      },
    });
  }

  async remove(id: string, userId: string) {
    const existing = await this.prisma.recurringBill.findFirst({ where: { id, userId } });
    if (!existing) throw new NotFoundException('Conta fixa não encontrada');

    // Soft delete: desativa em vez de apagar, pra manter o histórico dos
    // lançamentos já gerados (eles só perdem o vínculo, não são apagados).
    await this.prisma.recurringBill.update({ where: { id }, data: { isActive: false } });
    return { id };
  }

  /**
   * Gera, de forma idempotente, o lançamento (PENDING) do mês corrente para
   * cada conta fixa ativa do usuário que ainda não tem lançamento nesse mês.
   * Chamado pelo frontend ao abrir Dashboard/Transações.
   */
  async sync(userId: string) {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

    const bills = await this.prisma.recurringBill.findMany({ where: { userId, isActive: true } });

    let generated = 0;
    for (const bill of bills) {
      const alreadyGenerated = await this.prisma.transaction.findFirst({
        where: { recurringBillId: bill.id, date: { gte: monthStart, lt: monthEnd } },
        select: { id: true },
      });
      if (alreadyGenerated) continue;

      let amount: number = bill.defaultAmount != null ? Number(bill.defaultAmount) : 0;
      if (bill.defaultAmount == null) {
        const lastPaid = await this.prisma.transaction.findFirst({
          where: { recurringBillId: bill.id, status: 'PAID' },
          orderBy: { date: 'desc' },
          select: { amount: true },
        });
        amount = lastPaid ? Number(lastPaid.amount) : 0;
      }

      const dueDate = new Date(now.getFullYear(), now.getMonth(), Math.min(bill.dueDay, lastDayOfMonth));

      await this.prisma.transaction.create({
        data: {
          userId,
          accountId: bill.accountId,
          categoryId: bill.categoryId,
          type: 'EXPENSE',
          description: bill.description,
          amount,
          status: 'PENDING',
          date: dueDate,
          recurringBillId: bill.id,
        },
      });
      generated++;
    }

    return { generated };
  }

  private async ensureCategoryOwnership(categoryId: string, userId: string) {
    const category = await this.prisma.category.findFirst({ where: { id: categoryId, userId } });
    if (!category) throw new ForbiddenException('Categoria não encontrada ou não pertence ao usuário');
  }

  private async ensureAccountOwnership(accountId: string, userId: string) {
    const account = await this.prisma.account.findFirst({ where: { id: accountId, userId } });
    if (!account) throw new ForbiddenException('Conta não encontrada ou não pertence ao usuário');
  }
}
