import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { UpsertBudgetDto } from './dto/upsert-budget.dto';

/**
 * Orçamento por categoria e mês. O quanto já foi gasto por categoria vem do
 * endpoint do dashboard (mesma regra de cálculo, ex.: compras no cartão), então
 * aqui só guardamos o valor planejado.
 */
@Injectable()
export class BudgetsService {
  constructor(private prisma: PrismaService) {}

  async findAll(userId: string, month: number, year: number) {
    const budgets = await this.prisma.budget.findMany({
      where: { userId, month, year },
      include: { category: { select: { name: true, color: true, icon: true } } },
      orderBy: { category: { name: 'asc' } },
    });

    return budgets.map((b) => ({
      id: b.id,
      categoryId: b.categoryId,
      category: b.category,
      month: b.month,
      year: b.year,
      amount: Number(b.amount),
    }));
  }

  async upsert(userId: string, dto: UpsertBudgetDto) {
    const category = await this.prisma.category.findFirst({ where: { id: dto.categoryId, userId } });
    if (!category) throw new ForbiddenException('Categoria não encontrada ou não pertence ao usuário');

    const budget = await this.prisma.budget.upsert({
      where: {
        userId_categoryId_month_year: { userId, categoryId: dto.categoryId, month: dto.month, year: dto.year },
      },
      create: { userId, categoryId: dto.categoryId, month: dto.month, year: dto.year, amount: dto.amount },
      update: { amount: dto.amount },
    });

    return { id: budget.id, categoryId: budget.categoryId, month: budget.month, year: budget.year, amount: Number(budget.amount) };
  }

  async remove(id: string, userId: string) {
    const existing = await this.prisma.budget.findFirst({ where: { id, userId } });
    if (!existing) throw new NotFoundException('Orçamento não encontrado');
    await this.prisma.budget.delete({ where: { id } });
    return { id };
  }

  /** Copia o orçamento do mês anterior para o mês informado (só categorias que ainda não têm valor). */
  async copyFromPrevious(userId: string, month: number, year: number) {
    const prev = new Date(year, month - 2, 1);
    const previous = await this.prisma.budget.findMany({
      where: { userId, month: prev.getMonth() + 1, year: prev.getFullYear() },
    });

    const result = await this.prisma.budget.createMany({
      data: previous.map((b) => ({ userId, categoryId: b.categoryId, month, year, amount: b.amount })),
      skipDuplicates: true,
    });

    return { copied: result.count };
  }
}
