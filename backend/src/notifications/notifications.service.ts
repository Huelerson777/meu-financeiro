import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { NotificationType } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { DashboardService } from '../dashboard/dashboard.service';

const DUE_SOON_DAYS = 5;

const MONTH_NAMES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

@Injectable()
export class NotificationsService {
  // evita refazer as consultas de orçamento/metas a cada refetch do sino (que roda a cada minuto)
  private lastPlanningSync = new Map<string, number>();

  constructor(
    private prisma: PrismaService,
    private dashboardService: DashboardService,
  ) {}

  /**
   * Cria uma notificação avulsa — usado por outros módulos (ex: Feedback,
   * ao avisar o usuário que o chamado dele foi resolvido) que não têm um
   * fluxo de sincronização próprio como o de vencimentos abaixo.
   */
  create(data: { userId: string; type: NotificationType; title: string; message: string; referenceId?: string }) {
    return this.prisma.notification.create({ data });
  }

  /**
   * Lista as notificações do usuário. Antes de listar, sincroniza novos
   * alertas de vencimento próximo (parcelas de cartão não pagas e contas
   * pendentes), evitando duplicar quando já existe uma notificação não lida
   * para o mesmo lançamento (controlado por referenceId).
   */
  async list(userId: string) {
    await this.syncDueSoon(userId);
    await this.syncInvoiceClosed(userId);
    await this.syncPlanning(userId);
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async unreadCount(userId: string) {
    await this.syncDueSoon(userId);
    await this.syncInvoiceClosed(userId);
    await this.syncPlanning(userId);
    return this.prisma.notification.count({ where: { userId, read: false } });
  }

  async markRead(id: string, userId: string) {
    const notification = await this.prisma.notification.findUnique({ where: { id } });
    if (!notification) throw new NotFoundException('Notificação não encontrada');
    if (notification.userId !== userId) throw new ForbiddenException('Esta notificação não pertence a você');

    return this.prisma.notification.update({ where: { id }, data: { read: true } });
  }

  async markAllRead(userId: string) {
    await this.prisma.notification.updateMany({ where: { userId, read: false }, data: { read: true } });
    return { success: true };
  }


  /**
   * Avisos de planejamento: orçamento por categoria chegando perto (90%) ou estourado, e marcos das metas
   * (metade e conclusão). Cada aviso tem um referenceId próprio (inclui mês/nível), então não repete.
   */
  private async syncPlanning(userId: string) {
    const last = this.lastPlanningSync.get(userId) ?? 0;
    if (Date.now() - last < 60_000) return;
    this.lastPlanningSync.set(userId, Date.now());

    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();

    const [budgets, spentByCategory, goals, existingRefs] = await Promise.all([
      this.prisma.budget.findMany({ where: { userId, month, year }, include: { category: { select: { name: true } } } }),
      this.dashboardService.getExpensesByCategory(userId, month, year),
      this.prisma.goal.findMany({ where: { userId } }),
      this.prisma.notification.findMany({
        where: { userId, referenceId: { not: null }, type: { in: ['BUDGET_EXCEEDED', 'GOAL_PROGRESS'] } },
        select: { referenceId: true },
      }),
    ]);
    const existing = new Set(existingRefs.map((n) => n.referenceId));
    const toCreate: { userId: string; type: 'BUDGET_EXCEEDED' | 'GOAL_PROGRESS'; title: string; message: string; referenceId: string }[] = [];
    const brl = (v: number) => `R$ ${v.toFixed(2).replace('.', ',')}`;

    const spentMap = new Map((spentByCategory as { categoryId: string | null; total: number }[]).map((c) => [c.categoryId, Number(c.total)]));
    for (const budget of budgets) {
      const amount = Number(budget.amount);
      const spent = spentMap.get(budget.categoryId) ?? 0;
      if (amount <= 0) continue;
      const ratio = spent / amount;
      if (ratio < 0.9) continue;

      const level = ratio >= 1 ? 'over' : 'near';
      const referenceId = `budget-${budget.id}-${year}-${month}-${level}`;
      // se já avisou que estourou, não manda o "perto" depois; e vice-versa não há problema
      if (existing.has(referenceId) || existing.has(`budget-${budget.id}-${year}-${month}-over`)) continue;

      toCreate.push({
        userId,
        type: 'BUDGET_EXCEEDED',
        title: level === 'over' ? `${budget.category.name} passou do orçamento` : `${budget.category.name} perto do limite`,
        message:
          level === 'over'
            ? `Você gastou ${brl(spent)} de ${brl(amount)} planejados — ${brl(spent - amount)} acima.`
            : `Você já usou ${Math.round(ratio * 100)}% do orçamento (${brl(spent)} de ${brl(amount)}).`,
        referenceId,
      });
    }

    // metas: só avisa marcos de metas mexidas recentemente (evita uma enxurrada para metas antigas)
    const recent = Date.now() - 7 * 24 * 3600 * 1000;
    for (const goal of goals) {
      const target = Number(goal.targetAmount);
      if (target <= 0 || goal.updatedAt.getTime() < recent) continue;
      const progress = Number(goal.currentAmount) / target;

      const milestones: [string, boolean, string, string][] = [
        ['100', progress >= 1, `Meta concluída: ${goal.name}`, `Você chegou aos ${brl(target)} planejados.`],
        ['50', progress >= 0.5 && progress < 1, `Metade da meta: ${goal.name}`, `Você já juntou ${brl(Number(goal.currentAmount))} de ${brl(target)}.`],
      ];
      for (const [mark, reached, title, message] of milestones) {
        const referenceId = `goal-${goal.id}-${mark}`;
        if (reached && !existing.has(referenceId)) {
          toCreate.push({ userId, type: 'GOAL_PROGRESS', title, message, referenceId });
        }
      }
    }

    if (toCreate.length > 0) await this.prisma.notification.createMany({ data: toCreate });
  }

  private async syncDueSoon(userId: string) {
    const today = new Date(new Date().setHours(0, 0, 0, 0));
    const limit = new Date(today);
    limit.setDate(limit.getDate() + DUE_SOON_DAYS);
    limit.setHours(23, 59, 59, 999);

    const [openInstallments, pendingBills, existingRefs] = await Promise.all([
      this.prisma.installment.findMany({
        where: { paid: false, dueDate: { lte: limit }, transaction: { userId } },
        include: { transaction: { select: { description: true, card: { select: { name: true } } } } },
      }),
      // cardId: null pra não duplicar aviso: parcelas de cartão pendentes já
      // geram notificação própria via openInstallments, com nome do cartão.
      this.prisma.transaction.findMany({
        where: { userId, type: 'EXPENSE', status: 'PENDING', date: { lte: limit }, cardId: null },
      }),
      this.prisma.notification.findMany({
        where: { userId, referenceId: { not: null } },
        select: { referenceId: true },
      }),
    ]);

    const existingRefSet = new Set(existingRefs.map((n) => n.referenceId));
    const toCreate: {
      userId: string;
      type: 'CARD_DUE' | 'BILL_DUE';
      title: string;
      message: string;
      referenceId: string;
    }[] = [];

    for (const installment of openInstallments) {
      if (existingRefSet.has(installment.id)) continue;
      const dueDate = installment.dueDate;
      const isOverdue = dueDate < today;
      const cardName = installment.transaction.card?.name ?? 'cartão';
      const dateLabel = dueDate.toLocaleDateString('pt-BR');
      const description = installment.transaction.description.replace(/\s\(\d+\/\d+\)$/, '');

      toCreate.push({
        userId,
        type: 'CARD_DUE',
        title: isOverdue ? 'Parcela em atraso' : 'Parcela perto do vencimento',
        message: `${cardName}: parcela ${installment.number}/${installment.totalCount} de "${description}" ${
          isOverdue ? 'venceu em' : 'vence em'
        } ${dateLabel}.`,
        referenceId: installment.id,
      });
    }

    for (const bill of pendingBills) {
      if (existingRefSet.has(bill.id)) continue;
      const isOverdue = bill.date < today;
      const dateLabel = bill.date.toLocaleDateString('pt-BR');

      toCreate.push({
        userId,
        type: 'BILL_DUE',
        title: isOverdue ? 'Conta em atraso' : 'Conta perto do vencimento',
        message: `"${bill.description}" ${isOverdue ? 'venceu em' : 'vence em'} ${dateLabel}.`,
        referenceId: bill.id,
      });
    }

    if (toCreate.length > 0) {
      await this.prisma.notification.createMany({ data: toCreate });
    }
  }

  /**
   * Cria um aviso "fatura fechou no valor de X" pra cada cartão do usuário,
   * assim que o dia de fechamento passa. Mesma regra de ciclo usada em
   * CardsService.calculateInstallmentDueDate: a fatura que fechou é a do mês
   * corrente se hoje já passou do dia de fechamento, senão é a do mês
   * anterior. referenceId inclui o mês/ano do fechamento pra nunca duplicar
   * o aviso da mesma fatura.
   */
  private async syncInvoiceClosed(userId: string) {
    const today = new Date(new Date().setHours(0, 0, 0, 0));
    const cards = await this.prisma.card.findMany({ where: { userId, isArchived: false } });
    if (cards.length === 0) return;

    const existingRefs = await this.prisma.notification.findMany({
      where: { userId, referenceId: { not: null } },
      select: { referenceId: true },
    });
    const existingRefSet = new Set(existingRefs.map((n) => n.referenceId));

    const toCreate: { userId: string; type: 'CARD_INVOICE_CLOSED'; title: string; message: string; referenceId: string }[] = [];

    for (const card of cards) {
      let closingMonth = today.getMonth();
      let closingYear = today.getFullYear();
      if (today.getDate() < card.closingDay) {
        closingMonth -= 1; // ainda não fechou este mês — o último fechamento foi no mês anterior
      }
      const closingDate = new Date(closingYear, closingMonth, card.closingDay);
      closingYear = closingDate.getFullYear();
      closingMonth = closingDate.getMonth();

      const referenceId = `card-invoice-closed-${card.id}-${closingYear}-${closingMonth}`;
      if (existingRefSet.has(referenceId)) continue;

      let dueMonth = closingMonth;
      if (card.dueDay < card.closingDay) dueMonth += 1;
      const dueDate = new Date(closingYear, dueMonth, card.dueDay);

      const start = new Date(dueDate.getFullYear(), dueDate.getMonth(), 1);
      const end = new Date(dueDate.getFullYear(), dueDate.getMonth() + 1, 1);

      const transactions = await this.prisma.transaction.findMany({
        where: { cardId: card.id, userId, date: { gte: start, lt: end } },
        select: { amount: true },
      });
      if (transactions.length === 0) continue; // nada lançado nessa fatura, não notifica

      const total = transactions.reduce((acc, t) => acc + Number(t.amount), 0);
      if (total <= 0) continue; // fatura zerada ou só com créditos, não notifica

      toCreate.push({
        userId,
        type: 'CARD_INVOICE_CLOSED',
        title: 'Fatura fechada',
        message: `Sua fatura do ${card.name} de ${MONTH_NAMES[dueDate.getMonth()]} fechou no valor de R$ ${total.toFixed(2)}. Vence em ${dueDate.toLocaleDateString('pt-BR')}.`,
        referenceId,
      });
    }

    if (toCreate.length > 0) {
      await this.prisma.notification.createMany({ data: toCreate });
    }
  }
}
