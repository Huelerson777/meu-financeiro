import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { NotificationType } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';

const DUE_SOON_DAYS = 5;

@Injectable()
export class NotificationsService {
  constructor(private prisma: PrismaService) {}

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
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async unreadCount(userId: string) {
    await this.syncDueSoon(userId);
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
}
