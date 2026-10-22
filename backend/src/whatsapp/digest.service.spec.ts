import { DigestService } from './digest.service';
import { WHATSAPP_NOTE, formatBRL } from './receipt-tools';

// 22h de 22/10 em Brasília já é 01h de 23/10 em UTC: o "hoje" tem que ser 22/10.
const NOW = new Date('2026-10-23T01:00:00.000Z');

type Setup = {
  todayAgg?: { _sum: { amount: number | null }; _count: number };
  bills?: { description: string; amount: number; date: Date }[];
  installments?: unknown[];
  summary?: { totalExpense: number; leftovers: number; comparison: { expenseChangePct: number | null } };
  users?: { id: string; whatsappNumber: string }[];
};

function setup(opts: Setup = {}) {
  const prisma = {
    user: { findMany: jest.fn().mockResolvedValue(opts.users ?? []) },
    transaction: {
      aggregate: jest.fn().mockResolvedValue(opts.todayAgg ?? { _sum: { amount: 0 }, _count: 0 }),
      findMany: jest.fn().mockResolvedValue(opts.bills ?? []),
    },
    installment: { findMany: jest.fn().mockResolvedValue(opts.installments ?? []) },
  };
  const dashboard = {
    getSummary: jest
      .fn()
      .mockResolvedValue(opts.summary ?? { totalExpense: 3000, leftovers: 4500, comparison: { expenseChangePct: 10 } }),
  };
  const whatsapp = { sendProactiveMessage: jest.fn().mockResolvedValue(true) };
  const service = new DigestService(prisma as any, dashboard as any, whatsapp as any);
  return { service, prisma, dashboard, whatsapp };
}

describe('DigestService.buildDigest', () => {
  it('resume o dia, o que vence e o mês', async () => {
    const { service } = setup({
      todayAgg: { _sum: { amount: 120 }, _count: 3 },
      bills: [
        { description: 'Aluguel', amount: 1240, date: new Date('2026-10-23T12:00:00.000Z') },
        { description: 'Internet', amount: 100, date: new Date('2026-10-22T12:00:00.000Z') },
        { description: 'Luz', amount: 80, date: new Date('2026-10-20T12:00:00.000Z') },
      ],
      installments: [
        {
          amount: 300,
          dueDate: new Date('2026-10-23T12:00:00.000Z'),
          number: 2,
          totalCount: 5,
          transaction: { description: 'Notebook (2/5)', card: { name: 'Nubank' } },
        },
      ],
    });

    const text = await service.buildDigest('u1', NOW);

    expect(text).toContain('Resumo do dia');
    expect(text).toContain(`Hoje: ${formatBRL(120)} em 3 lançamentos.`);
    expect(text).toContain(`• Luz — venceu em 20/10 (${formatBRL(80)})`);
    expect(text).toContain(`• Internet — vence hoje (${formatBRL(100)})`);
    expect(text).toContain(`• Aluguel — vence amanhã (${formatBRL(1240)})`);
    expect(text).toContain(`• Nubank: Notebook 2/5 — vence amanhã (${formatBRL(300)})`);
    expect(text).toContain(`No mês: ${formatBRL(3000)} em gastos (+10% vs mês passado). Sobrou ${formatBRL(4500)}.`);
    // atrasadas e de hoje vêm antes das de amanhã
    expect(text.indexOf('Luz')).toBeLessThan(text.indexOf('Internet'));
    expect(text.indexOf('Internet')).toBeLessThan(text.indexOf('Aluguel'));
  });

  it('usa a data de hoje no fuso de São Paulo para filtrar o dia', async () => {
    const { service, prisma } = setup();

    await service.buildDigest('u1', NOW);

    const where = prisma.transaction.aggregate.mock.calls[0][0].where;
    expect(where.date.gte).toEqual(new Date('2026-10-22T00:00:00.000Z'));
    expect(where.date.lte).toEqual(new Date('2026-10-22T23:59:59.999Z'));
    expect(where.status).toBe('PAID');
  });

  it('sem gastos nem vencimentos: mensagem curta, sem seção Vencendo', async () => {
    const { service } = setup();

    const text = await service.buildDigest('u1', NOW);

    expect(text).toContain('Hoje: nenhum gasto registrado.');
    expect(text).not.toContain('Vencendo');
  });

  it('singular para 1 lançamento e sem variação quando não há base de comparação', async () => {
    const { service } = setup({
      todayAgg: { _sum: { amount: 20 }, _count: 1 },
      summary: { totalExpense: 500, leftovers: 100, comparison: { expenseChangePct: null } },
    });

    const text = await service.buildDigest('u1', NOW);

    expect(text).toContain('em 1 lançamento.');
    expect(text).not.toContain('vs mês passado');
  });

  it('variação negativa sai com vírgula decimal e sinal', async () => {
    const { service } = setup({
      summary: { totalExpense: 500, leftovers: 100, comparison: { expenseChangePct: -12.5 } },
    });

    expect(await service.buildDigest('u1', NOW)).toContain('(-12,5% vs mês passado)');
  });

  it('limita a lista de vencimentos e indica quantos ficaram de fora', async () => {
    const bills = Array.from({ length: 7 }, (_, i) => ({
      description: `Conta ${i + 1}`,
      amount: 10,
      date: new Date('2026-10-23T12:00:00.000Z'),
    }));
    const { service } = setup({ bills });

    const text = await service.buildDigest('u1', NOW);

    expect(text).toContain('Conta 5');
    expect(text).not.toContain('Conta 6');
    expect(text).toContain('e mais 2…');
  });
});

describe('DigestService.sendDailyDigests', () => {
  const users = [
    { id: 'u1', whatsappNumber: '5549988048805' },
    { id: 'u2', whatsappNumber: '5511999999999' },
  ];

  it('só busca quem tem WhatsApp e lançou algo por lá nas últimas 23h', async () => {
    const { service, prisma } = setup({ users: [] });

    const result = await service.sendDailyDigests();

    const where = prisma.user.findMany.mock.calls[0][0].where;
    expect(where.whatsappNumber).toEqual({ not: null });
    expect(where.transactions.some.notes).toBe(WHATSAPP_NOTE);
    const ageMs = Date.now() - where.transactions.some.createdAt.gte.getTime();
    expect(Math.abs(ageMs - 23 * 60 * 60 * 1000)).toBeLessThan(5_000);
    expect(result).toEqual({ eligible: 0, sent: 0, failed: 0 });
  });

  it('envia a cada elegível e conta enviados e falhas', async () => {
    const { service, whatsapp } = setup({ users });
    whatsapp.sendProactiveMessage.mockResolvedValueOnce(true).mockResolvedValueOnce(false);

    const result = await service.sendDailyDigests();

    expect(whatsapp.sendProactiveMessage).toHaveBeenCalledTimes(2);
    expect(whatsapp.sendProactiveMessage.mock.calls[0][0]).toBe('5549988048805');
    expect(result).toEqual({ eligible: 2, sent: 1, failed: 1 });
  });

  it('uma falha ao montar o resumo de um usuário não impede os outros', async () => {
    const { service, whatsapp, dashboard } = setup({ users });
    dashboard.getSummary.mockRejectedValueOnce(new Error('boom')).mockResolvedValue({
      totalExpense: 1,
      leftovers: 1,
      comparison: { expenseChangePct: 0 },
    });

    const result = await service.sendDailyDigests();

    expect(whatsapp.sendProactiveMessage).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ eligible: 2, sent: 1, failed: 1 });
  });

  it('dryRun devolve os textos e não envia nada', async () => {
    const { service, whatsapp } = setup({ users });

    const result = await service.sendDailyDigests({ dryRun: true });

    expect(whatsapp.sendProactiveMessage).not.toHaveBeenCalled();
    expect(result.sent).toBe(0);
    expect(result.messages).toHaveLength(2);
    expect(result.messages![0].userId).toBe('u1');
    expect(result.messages![0].text).toContain('Resumo do dia');
  });
});
