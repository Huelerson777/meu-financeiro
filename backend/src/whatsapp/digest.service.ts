import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { DashboardService } from '../dashboard/dashboard.service';
import { WhatsappService } from './whatsapp.service';
import { WHATSAPP_NOTE, formatBRL } from './receipt-tools';
import { todayInBrazil } from './query-tools';

/**
 * Janela em que ainda dá pra mandar texto livre: o WhatsApp só permite isso
 * até 24h depois da última mensagem do usuário (depois exige template
 * aprovado). Sem coluna de "última mensagem" (migrations aqui são manuais),
 * usa como proxy ter lançado algo pelo WhatsApp nas últimas 23h.
 */
const SEND_WINDOW_MS = 23 * 60 * 60 * 1000;
const MAX_DUE_LINES = 5;

export type DigestResult = {
  eligible: number;
  sent: number;
  failed: number;
  /** Só no dryRun: o texto que seria enviado a cada usuário. */
  messages?: { userId: string; text: string }[];
};

type DueItem = { description: string; amount: number; date: Date };

@Injectable()
export class DigestService {
  private readonly logger = new Logger(DigestService.name);

  constructor(
    private prisma: PrismaService,
    private dashboardService: DashboardService,
    private whatsappService: WhatsappService,
  ) {}

  /** Envia (ou, com dryRun, só monta) o resumo do dia pra quem usou o WhatsApp nas últimas 23h. */
  async sendDailyDigests(options: { dryRun?: boolean } = {}): Promise<DigestResult> {
    const users = await this.prisma.user.findMany({
      where: {
        whatsappNumber: { not: null },
        transactions: {
          some: { notes: WHATSAPP_NOTE, createdAt: { gte: new Date(Date.now() - SEND_WINDOW_MS) } },
        },
      },
      select: { id: true, whatsappNumber: true },
    });

    const result: DigestResult = { eligible: users.length, sent: 0, failed: 0 };
    if (options.dryRun) result.messages = [];

    for (const user of users) {
      try {
        const text = await this.buildDigest(user.id);
        if (options.dryRun) {
          result.messages!.push({ userId: user.id, text });
          continue;
        }
        const ok = await this.whatsappService.sendProactiveMessage(user.whatsappNumber!, text);
        if (ok) result.sent++;
        else result.failed++;
      } catch (err) {
        this.logger.error(`Falha ao montar o resumo do usuário ${user.id}`, err);
        result.failed++;
      }
    }

    return result;
  }

  async buildDigest(userId: string, now: Date = new Date()): Promise<string> {
    const today = todayInBrazil(now);
    const tomorrow = this.addDays(today, 1);
    const dayStart = new Date(`${today}T00:00:00.000Z`);
    const dayEnd = new Date(`${today}T23:59:59.999Z`);
    const dueLimit = new Date(`${tomorrow}T23:59:59.999Z`);

    const [todayAgg, pendingBills, openInstallments, summary] = await Promise.all([
      this.prisma.transaction.aggregate({
        where: { userId, type: 'EXPENSE', status: 'PAID', date: { gte: dayStart, lte: dayEnd } },
        _sum: { amount: true },
        _count: true,
      }),
      // cardId: null — parcelas de cartão pendentes entram pelas installments abaixo
      this.prisma.transaction.findMany({
        where: { userId, type: 'EXPENSE', status: 'PENDING', cardId: null, date: { lte: dueLimit } },
        orderBy: { date: 'asc' },
        select: { description: true, amount: true, date: true },
      }),
      this.prisma.installment.findMany({
        where: { paid: false, dueDate: { lte: dueLimit }, transaction: { userId } },
        orderBy: { dueDate: 'asc' },
        select: {
          amount: true,
          dueDate: true,
          number: true,
          totalCount: true,
          transaction: { select: { description: true, card: { select: { name: true } } } },
        },
      }),
      this.dashboardService.getSummary(userId),
    ]);

    const due: DueItem[] = [
      ...pendingBills.map((b) => ({ description: b.description, amount: Number(b.amount), date: b.date })),
      ...openInstallments.map((i) => ({
        description: `${i.transaction.card?.name ?? 'Cartão'}: ${i.transaction.description.replace(/\s\(\d+\/\d+\)$/, '')} ${i.number}/${i.totalCount}`,
        amount: Number(i.amount),
        date: i.dueDate,
      })),
    ].sort((a, b) => a.date.getTime() - b.date.getTime());

    const lines = ['🌙 *Resumo do dia*'];

    const spentToday = Number(todayAgg._sum.amount ?? 0);
    lines.push(
      todayAgg._count > 0
        ? `Hoje: ${formatBRL(spentToday)} em ${todayAgg._count} ${todayAgg._count === 1 ? 'lançamento' : 'lançamentos'}.`
        : 'Hoje: nenhum gasto registrado.',
    );

    if (due.length > 0) {
      lines.push('', 'Vencendo:');
      for (const item of due.slice(0, MAX_DUE_LINES)) {
        lines.push(`• ${item.description} — ${this.dueLabel(item.date, today)} (${formatBRL(item.amount)})`);
      }
      if (due.length > MAX_DUE_LINES) lines.push(`• e mais ${due.length - MAX_DUE_LINES}…`);
    }

    const change = summary.comparison.expenseChangePct;
    const changeLabel =
      change === null || change === 0 ? '' : ` (${change > 0 ? '+' : ''}${String(change).replace('.', ',')}% vs mês passado)`;
    lines.push(
      '',
      `No mês: ${formatBRL(summary.totalExpense)} em gastos${changeLabel}. Sobrou ${formatBRL(summary.leftovers)}.`,
    );

    return lines.join('\n');
  }

  private dueLabel(date: Date, today: string): string {
    const day = date.toISOString().slice(0, 10);
    if (day < today) return `venceu em ${day.split('-').reverse().slice(0, 2).join('/')}`;
    if (day === today) return 'vence hoje';
    return 'vence amanhã';
  }

  private addDays(isoDate: string, days: number): string {
    const d = new Date(`${isoDate}T00:00:00.000Z`);
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
  }
}
