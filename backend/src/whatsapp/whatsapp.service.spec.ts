import { WhatsappService } from './whatsapp.service';
import { isTranscriptionConfigured, transcribeAudio } from './transcription';
import { MAX_QUERY_ROUNDS } from './query-tools';
import { RECEIPT_FOOTER, WHATSAPP_NOTE, formatBRL } from './receipt-tools';

jest.mock('./transcription', () => ({
  isTranscriptionConfigured: jest.fn(),
  transcribeAudio: jest.fn(),
}));

const USER = { id: 'user-1' };
const ACCOUNTS = [
  { id: 'acc-inter', name: 'Inter' },
  { id: 'acc-xp', name: 'XP Huelerson' },
];
const CATEGORIES = [
  { id: 'cat-mercado', name: 'Mercado' },
  { id: 'cat-lazer', name: 'Lazer' },
];

const LAST_TX = {
  id: 'tx-1',
  type: 'EXPENSE',
  description: 'Mercado',
  amount: 20,
  date: new Date('2026-10-22T12:00:00.000Z'),
  status: 'PAID',
  account: { name: 'Inter' },
  category: { name: 'Mercado' },
};

function toolUse(name: string, input: Record<string, unknown> = {}) {
  return { content: [{ type: 'tool_use', id: 't1', name, input }] };
}

function textOnly(text: string) {
  return { content: [{ type: 'text', text }] };
}

function setup(options: { lastTx?: typeof LAST_TX | null } = {}) {
  process.env.ANTHROPIC_API_KEY = 'chave-de-teste';

  const prisma = {
    user: { findFirst: jest.fn().mockResolvedValue(USER) },
    account: { findMany: jest.fn().mockResolvedValue(ACCOUNTS) },
    transaction: {
      findFirst: jest.fn().mockResolvedValue(options.lastTx === undefined ? null : options.lastTx),
      aggregate: jest.fn().mockResolvedValue({ _sum: { amount: 0 }, _count: 0 }),
      findMany: jest.fn().mockResolvedValue([]),
    },
    whatsappSession: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({}),
      update: jest.fn().mockResolvedValue({}),
      delete: jest.fn().mockResolvedValue({}),
    },
  };
  const transactions = {
    create: jest.fn().mockResolvedValue({ id: 'tx-new' }),
    update: jest.fn().mockResolvedValue({}),
    remove: jest.fn().mockResolvedValue({ id: 'tx-1' }),
  };
  const categories = { findAll: jest.fn().mockResolvedValue(CATEGORIES) };
  const dashboard = {
    getSummary: jest.fn().mockResolvedValue({
      currentBalance: 5000,
      totalIncome: 8000,
      totalExpense: 3000,
      totalInvested: 500,
      leftovers: 4500,
      comparison: { expenseChangePct: 10 },
      monthlyFlow: ['não deve ir pro modelo'],
    }),
  };
  const reports = {
    getByCategory: jest.fn().mockResolvedValue({
      startDate: '2026-10-01',
      endDate: '2026-10-31',
      type: 'EXPENSE',
      total: 300,
      items: [{ name: 'Mercado', amount: 200, percentage: 66.7, color: '#fff', icon: 'x', categoryId: 'c' }],
    }),
  };

  const service = new WhatsappService(
    prisma as any,
    transactions as any,
    categories as any,
    dashboard as any,
    reports as any,
  );
  const create = jest.fn();
  (service as any).anthropic = { messages: { create } };

  const send = (body: string) =>
    service.handleTwilioPayload({ From: 'whatsapp:+5549988048805', Body: body, NumMedia: '0' });

  return { service, prisma, transactions, dashboard, reports, create, send };
}

describe('WhatsappService — recibo com corrigir/desfazer', () => {
  it('lança a transação marcada como feita pelo WhatsApp e responde com recibo + rodapé', async () => {
    const { send, create, transactions } = setup();
    create.mockResolvedValue(
      toolUse('create_transaction', {
        type: 'EXPENSE',
        description: 'Mercado',
        amount: 20,
        accountId: 'acc-inter',
        categoryId: 'cat-mercado',
        date: '2026-10-22',
      }),
    );

    const replies = await send('gastei 20 no mercado na inter');

    expect(transactions.create).toHaveBeenCalledWith(
      USER.id,
      expect.objectContaining({ amount: 20, accountId: 'acc-inter', notes: WHATSAPP_NOTE }),
    );
    expect(replies).toHaveLength(1);
    expect(replies[0]).toContain('✅ Lançado: Mercado');
    expect(replies[0]).toContain(RECEIPT_FOOTER);
  });

  it('informa ao modelo o último lançamento corrigível', async () => {
    const { send, create } = setup({ lastTx: LAST_TX });
    create.mockResolvedValue(textOnly('ok'));

    await send('oi');

    const { system, tools } = create.mock.calls[0][0];
    expect(system).toContain('Último lançamento feito por aqui');
    expect(system).toContain('Mercado');
    expect(tools.map((t: { name: string }) => t.name)).toEqual([
      'create_transaction',
      'update_last_transaction',
      'undo_last_transaction',
      'get_month_summary',
      'get_spending_by_category',
      'search_transactions',
      'get_account_balances',
    ]);
  });

  it('só considera lançamentos feitos pelo WhatsApp nas últimas 24h', async () => {
    const { send, create, prisma } = setup();
    create.mockResolvedValue(textOnly('ok'));

    await send('oi');

    const where = prisma.transaction.findFirst.mock.calls[0][0].where;
    expect(where.userId).toBe(USER.id);
    expect(where.notes).toBe(WHATSAPP_NOTE);
    const ageMs = Date.now() - where.createdAt.gte.getTime();
    expect(Math.abs(ageMs - 24 * 60 * 60 * 1000)).toBeLessThan(5_000);
  });

  it('desfaz o último lançamento', async () => {
    const { send, create, transactions } = setup({ lastTx: LAST_TX });
    create.mockResolvedValue(toolUse('undo_last_transaction'));

    const replies = await send('desfazer');

    expect(transactions.remove).toHaveBeenCalledWith('tx-1', USER.id);
    expect(replies[0]).toContain('↩️ Desfeito: Mercado');
  });

  it('não desfaz nada quando não há lançamento recente', async () => {
    const { send, create, transactions } = setup({ lastTx: null });
    create.mockResolvedValue(toolUse('undo_last_transaction'));

    const replies = await send('desfazer');

    expect(transactions.remove).not.toHaveBeenCalled();
    expect(replies[0]).toContain('Não achei nenhum lançamento');
  });

  it('corrige só os campos que mudam e mostra o antes → depois', async () => {
    const { send, create, transactions } = setup({ lastTx: LAST_TX });
    create.mockResolvedValue(toolUse('update_last_transaction', { amount: 25 }));

    const replies = await send('o valor é 25');

    expect(transactions.update).toHaveBeenCalledWith('tx-1', USER.id, { amount: 25 });
    expect(replies[0]).toContain(`valor: ${formatBRL(20)} → ${formatBRL(25)}`);
  });

  it('troca de conta e categoria só por ids que pertencem ao usuário', async () => {
    const { send, create, transactions } = setup({ lastTx: LAST_TX });
    create.mockResolvedValue(
      toolUse('update_last_transaction', { accountId: 'acc-xp', categoryId: 'cat-de-outro-usuario' }),
    );

    await send('era na XP');

    expect(transactions.update).toHaveBeenCalledWith('tx-1', USER.id, { accountId: 'acc-xp' });
  });

  it('não chama update quando nada mudou ou o modelo mandou dados inválidos', async () => {
    const { send, create, transactions } = setup({ lastTx: LAST_TX });
    create.mockResolvedValue(toolUse('update_last_transaction', { amount: -5, accountId: 'inventada' }));

    const replies = await send('muda aí');

    expect(transactions.update).not.toHaveBeenCalled();
    expect(replies[0]).toContain('Não entendi o que mudar');
  });

  it('não corrige nada quando não há lançamento recente', async () => {
    const { send, create, transactions } = setup({ lastTx: null });
    create.mockResolvedValue(toolUse('update_last_transaction', { amount: 25 }));

    const replies = await send('o valor é 25');

    expect(transactions.update).not.toHaveBeenCalled();
    expect(replies[0]).toContain('Não achei nenhum lançamento');
  });
});

describe('WhatsappService — áudio', () => {
  const originalFetch = global.fetch;
  const audioParams = {
    From: 'whatsapp:+5549988048805',
    Body: '',
    NumMedia: '1',
    MediaContentType0: 'audio/ogg',
    MediaUrl0: 'https://api.twilio.com/media/abc',
  };

  beforeEach(() => {
    (isTranscriptionConfigured as jest.Mock).mockReset();
    (transcribeAudio as jest.Mock).mockReset();
    global.fetch = jest.fn().mockResolvedValue({ arrayBuffer: async () => new TextEncoder().encode('ogg-bytes').buffer }) as unknown as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('transcreve o áudio e trata o texto como a mensagem do usuário', async () => {
    const { service, create } = setup();
    (isTranscriptionConfigured as jest.Mock).mockReturnValue(true);
    (transcribeAudio as jest.Mock).mockResolvedValue('gastei vinte no mercado');
    create.mockResolvedValue(textOnly('Qual conta?'));

    const replies = await service.handleTwilioPayload(audioParams);

    expect(transcribeAudio).toHaveBeenCalledWith(expect.any(Buffer), 'audio/ogg');
    expect(create.mock.calls[0][0].messages.at(-1).content).toEqual([{ type: 'text', text: 'gastei vinte no mercado' }]);
    expect(replies).toEqual(['Qual conta?']);
  });

  it('avisa que não ouve áudio quando a transcrição não está configurada', async () => {
    const { service, create } = setup();
    (isTranscriptionConfigured as jest.Mock).mockReturnValue(false);

    const replies = await service.handleTwilioPayload(audioParams);

    expect(create).not.toHaveBeenCalled();
    expect(transcribeAudio).not.toHaveBeenCalled();
    expect(replies[0]).toContain('Ainda não consigo ouvir áudios');
  });

  it('pede pra repetir quando a transcrição vem vazia', async () => {
    const { service, create } = setup();
    (isTranscriptionConfigured as jest.Mock).mockReturnValue(true);
    (transcribeAudio as jest.Mock).mockResolvedValue('');

    const replies = await service.handleTwilioPayload(audioParams);

    expect(create).not.toHaveBeenCalled();
    expect(replies[0]).toContain('Não consegui entender o áudio');
  });

  it('responde com erro amigável se o serviço de transcrição falhar', async () => {
    const { service, create } = setup();
    (isTranscriptionConfigured as jest.Mock).mockReturnValue(true);
    (transcribeAudio as jest.Mock).mockRejectedValue(new Error('boom'));

    const replies = await service.handleTwilioPayload(audioParams);

    expect(create).not.toHaveBeenCalled();
    expect(replies[0]).toContain('não consegui processar');
  });
});

describe('WhatsappService — consultas', () => {
  const queryTurn = (name: string, input: Record<string, unknown> = {}) => ({
    content: [{ type: 'tool_use', id: `q-${name}`, name, input }],
  });

  it('executa a consulta, devolve o resultado ao modelo e responde com o texto final', async () => {
    const { send, create, dashboard } = setup();
    create
      .mockResolvedValueOnce(queryTurn('get_month_summary', { month: 9, year: 2026 }))
      .mockResolvedValueOnce(textOnly('Sobraram R$ 4.500,00 em setembro.'));

    const replies = await send('quanto sobrou em setembro?');

    expect(dashboard.getSummary).toHaveBeenCalledWith(USER.id, 9, 2026);
    expect(create).toHaveBeenCalledTimes(2);
    const secondCall = create.mock.calls[1][0].messages;
    const toolResult = secondCall.at(-1).content[0];
    expect(toolResult.type).toBe('tool_result');
    expect(toolResult.tool_use_id).toBe('q-get_month_summary');
    const payload = JSON.parse(toolResult.content);
    expect(payload.quantoSobrou).toBe(4500);
    expect(payload.monthlyFlow).toBeUndefined();
    expect(replies).toEqual(['Sobraram R$ 4.500,00 em setembro.']);
  });

  it('guarda no histórico só o texto, sem as idas e vindas da ferramenta', async () => {
    const { send, create, prisma } = setup();
    create
      .mockResolvedValueOnce(queryTurn('get_account_balances'))
      .mockResolvedValueOnce(textOnly('Inter: R$ 100,00'));

    await send('qual meu saldo?');

    const saved = prisma.whatsappSession.create.mock.calls[0][0].data.messages;
    expect(saved).toHaveLength(2);
    expect(saved[0]).toEqual({ role: 'user', content: [{ type: 'text', text: 'qual meu saldo?' }] });
    expect(saved[1].role).toBe('assistant');
    expect(JSON.stringify(saved)).not.toContain('tool_use');
  });

  it('busca por texto na descrição, só pagos, ignorando datas inválidas', async () => {
    const { send, create, prisma } = setup();
    prisma.transaction.aggregate.mockResolvedValue({ _sum: { amount: 150.5 }, _count: 3 });
    create
      .mockResolvedValueOnce(
        queryTurn('search_transactions', { text: 'ifood', startDate: '2026-10-01', endDate: 'amanhã' }),
      )
      .mockResolvedValueOnce(textOnly('R$ 150,50 no iFood'));

    await send('quanto gastei no ifood?');

    const where = prisma.transaction.aggregate.mock.calls[0][0].where;
    expect(where.userId).toBe(USER.id);
    expect(where.status).toBe('PAID');
    expect(where.type).toBe('EXPENSE');
    expect(where.description).toEqual({ contains: 'ifood', mode: 'insensitive' });
    expect(where.date.gte).toEqual(new Date('2026-10-01T00:00:00.000Z'));
    expect(where.date.lte).toBeInstanceOf(Date);
    const payload = JSON.parse(create.mock.calls[1][0].messages.at(-1).content[0].content);
    expect(payload.total).toBe(150.5);
    expect(payload.quantidade).toBe(3);
  });

  it('consulta por categoria repassa período e tipo validados', async () => {
    const { send, create, reports } = setup();
    create
      .mockResolvedValueOnce(
        queryTurn('get_spending_by_category', { startDate: '2026-08-01', endDate: '2026-08-31', type: 'INCOME' }),
      )
      .mockResolvedValueOnce(textOnly('ok'));

    await send('de onde veio minha renda em agosto?');

    expect(reports.getByCategory).toHaveBeenCalledWith(USER.id, '2026-08-01', '2026-08-31', 'INCOME');
  });

  it('erro na consulta vira {error} pro modelo, sem derrubar a conversa', async () => {
    const { send, create, dashboard } = setup();
    dashboard.getSummary.mockRejectedValue(new Error('db fora do ar'));
    create
      .mockResolvedValueOnce(queryTurn('get_month_summary'))
      .mockResolvedValueOnce(textOnly('Não consegui consultar agora.'));

    const replies = await send('quanto sobrou?');

    const payload = JSON.parse(create.mock.calls[1][0].messages.at(-1).content[0].content);
    expect(payload.error).toBeDefined();
    expect(replies).toEqual(['Não consegui consultar agora.']);
  });

  it('limita as rodadas de consulta e usa mensagem de fallback', async () => {
    const { send, create } = setup();
    create.mockResolvedValue(queryTurn('get_account_balances'));

    const replies = await send('saldo?');

    expect(create).toHaveBeenCalledTimes(1 + MAX_QUERY_ROUNDS);
    expect(replies).toEqual(['Não consegui buscar isso agora. Pode tentar de novo?']);
  });

  it('se o modelo pedir consulta junto com escrita, executa só a escrita', async () => {
    const { send, create, transactions, dashboard } = setup();
    create.mockResolvedValue({
      content: [
        { type: 'tool_use', id: 'a', name: 'get_month_summary', input: {} },
        {
          type: 'tool_use',
          id: 'b',
          name: 'create_transaction',
          input: { type: 'EXPENSE', description: 'Uber', amount: 30, accountId: 'acc-inter' },
        },
      ],
    });

    const replies = await send('gastei 30 de uber na inter');

    expect(dashboard.getSummary).not.toHaveBeenCalled();
    expect(create).toHaveBeenCalledTimes(1);
    expect(transactions.create).toHaveBeenCalledTimes(1);
    expect(replies[0]).toContain('✅ Lançado: Uber');
  });
});

describe('WhatsappService — envio proativo', () => {
  const originalFetch = global.fetch;
  const env = { ...process.env };

  afterEach(() => {
    global.fetch = originalFetch;
    process.env = { ...env };
  });

  it('usa a Twilio quando configurada e tenta a outra forma do número se a primeira falhar', async () => {
    process.env.TWILIO_ACCOUNT_SID = 'AC123';
    process.env.TWILIO_AUTH_TOKEN = 'tok';
    process.env.TWILIO_WHATSAPP_FROM = '+14155238886';
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 422, text: async () => 'sem destinatário' })
      .mockResolvedValueOnce({ ok: true });
    global.fetch = fetchMock as unknown as typeof fetch;
    const { service } = setup();

    const ok = await service.sendProactiveMessage('554988048805', 'resumo');

    expect(ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][0]).toContain('api.twilio.com');
    expect(fetchMock.mock.calls[0][1].body.get('To')).toBe('whatsapp:+554988048805');
    expect(fetchMock.mock.calls[1][1].body.get('To')).toBe('whatsapp:+5549988048805');
  });

  it('devolve false quando a Twilio recusa as duas formas (ex.: fora da janela de 24h)', async () => {
    process.env.TWILIO_ACCOUNT_SID = 'AC123';
    process.env.TWILIO_AUTH_TOKEN = 'tok';
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 400, text: async () => 'ContentSid Required' }) as unknown as typeof fetch;
    const { service } = setup();

    expect(await service.sendProactiveMessage('5549988048805', 'resumo')).toBe(false);
  });

  it('cai na Meta quando a Twilio não está configurada', async () => {
    delete process.env.TWILIO_ACCOUNT_SID;
    delete process.env.TWILIO_AUTH_TOKEN;
    process.env.WHATSAPP_PHONE_NUMBER_ID = '999';
    const fetchMock = jest.fn().mockResolvedValue({ ok: true });
    global.fetch = fetchMock as unknown as typeof fetch;
    const { service } = setup();

    expect(await service.sendProactiveMessage('5549988048805', 'resumo')).toBe(true);
    expect(fetchMock.mock.calls[0][0]).toContain('graph.facebook.com');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).to).toBe('5549988048805');
  });

  it('não propaga exceção de rede: devolve false', async () => {
    delete process.env.TWILIO_ACCOUNT_SID;
    global.fetch = jest.fn().mockRejectedValue(new Error('sem rede')) as unknown as typeof fetch;
    const { service } = setup();

    expect(await service.sendProactiveMessage('5549988048805', 'resumo')).toBe(false);
  });
});
