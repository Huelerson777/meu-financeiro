import { WhatsappService } from './whatsapp.service';
import { isTranscriptionConfigured, transcribeAudio } from './transcription';
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
    transaction: { findFirst: jest.fn().mockResolvedValue(options.lastTx === undefined ? null : options.lastTx) },
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

  const service = new WhatsappService(prisma as any, transactions as any, categories as any);
  const create = jest.fn();
  (service as any).anthropic = { messages: { create } };

  const send = (body: string) =>
    service.handleTwilioPayload({ From: 'whatsapp:+5549988048805', Body: body, NumMedia: '0' });

  return { service, prisma, transactions, create, send };
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
