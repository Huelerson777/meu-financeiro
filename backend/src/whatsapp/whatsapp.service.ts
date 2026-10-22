import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import Anthropic from '@anthropic-ai/sdk';
import { PrismaService } from '../common/prisma/prisma.service';
import { TransactionsService } from '../transactions/transactions.service';
import { CategoriesService } from '../categories/categories.service';
import { DashboardService } from '../dashboard/dashboard.service';
import { ReportsService } from '../reports/reports.service';
import { CREATE_TRANSACTION_TOOL } from './create-transaction-tool';
import {
  MAX_QUERY_ROUNDS,
  QUERY_TOOLS,
  QUERY_TOOL_NAMES,
  parseIsoDate,
  todayInBrazil,
} from './query-tools';
import { isTranscriptionConfigured, transcribeAudio } from './transcription';
import { digitsOnly, isValidTwilioSignature, phoneVariants } from './whatsapp-utils';
import {
  RECEIPT_FOOTER,
  RECEIPT_WINDOW_MS,
  UNDO_LAST_TRANSACTION_TOOL,
  UPDATE_LAST_TRANSACTION_TOOL,
  WHATSAPP_NOTE,
  formatBRL,
} from './receipt-tools';

const GRAPH_API_VERSION = 'v20.0';
const GRAPH_API_URL = `https://graph.facebook.com/${GRAPH_API_VERSION}`;
const TWILIO_REPLY_WINDOW_MS = 12_000;
const MODEL =process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5';

/** Mensagem recebida já normalizada, independente do provedor (Meta ou Twilio). */
type IncomingMessage = {
  from: string;
  type: 'text' | 'image' | 'audio' | 'other';
  text?: string;
  caption?: string;
  loadMedia?: () => Promise<{ data: string; mimeType: string }>;
};

/** Como responder: cada provedor entrega o texto de um jeito. */
type Reply = (to: string, text: string) => Promise<void>;

/** Último lançamento feito pelo WhatsApp, ainda dentro da janela do recibo. */
type LastTransaction = {
  id: string;
  type: string;
  description: string;
  amount: number;
  date: Date;
  status: string;
  accountName: string | null;
  categoryName: string | null;
};

type NamedItem = { id: string; name: string };

type AnthropicMessage = { role: 'user' | 'assistant'; content: Anthropic.ContentBlockParam[] };

@Injectable()
export class WhatsappService {
  private readonly logger = new Logger(WhatsappService.name);
  private readonly anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  constructor(
    private prisma: PrismaService,
    private transactionsService: TransactionsService,
    private categoriesService: CategoriesService,
    private dashboardService: DashboardService,
    private reportsService: ReportsService,
  ) {}

  /**
   * Confere o header X-Hub-Signature-256 (HMAC-SHA256 do corpo bruto da
   * requisição com o App Secret) — é a única forma de garantir que a
   * chamada realmente veio da Meta e não de qualquer um que descubra a URL.
   */
  verifySignature(rawBody: Buffer | undefined, signatureHeader: string | undefined): boolean {
    const appSecret = process.env.WHATSAPP_APP_SECRET;
    if (!rawBody || !signatureHeader || !appSecret) return false;

    const expected = 'sha256=' + crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex');
    const expectedBuf = Buffer.from(expected);
    const receivedBuf = Buffer.from(signatureHeader);
    if (expectedBuf.length !== receivedBuf.length) return false;

    return crypto.timingSafeEqual(expectedBuf, receivedBuf);
  }

  /** Webhook da Meta (WhatsApp Cloud API). */
  async handleWebhookPayload(body: any) {
    const entries = body?.entry ?? [];
    for (const entry of entries) {
      for (const change of entry.changes ?? []) {
        const messages = change.value?.messages ?? [];
        for (const message of messages) {
          await this.processMessage(this.normalizeMetaMessage(message), this.replyViaMeta);
        }
      }
    }
  }

  /** Webhook da Twilio (form-urlencoded). Valida a assinatura antes de processar. */
  verifyTwilioSignature(url: string | undefined, params: Record<string, unknown>, signature: string | undefined) {
    return isValidTwilioSignature(process.env.TWILIO_AUTH_TOKEN, url, params, signature);
  }

  /**
   * Processa a mensagem e devolve as respostas pra irem no corpo (TwiML) da
   * resposta do webhook — é assim que a Twilio entrega respostas no WhatsApp
   * sem exigir template nem número verificado (conta trial). Se o Claude
   * passar de TWILIO_REPLY_WINDOW_MS (a Twilio desiste em ~15s), o que
   * sobrar vai pela API de envio.
   */
  async handleTwilioPayload(params: Record<string, string>): Promise<string[]> {
    const replies: string[] = [];
    let windowOpen = true;
    const reply: Reply = async (to, text) => {
      if (windowOpen) replies.push(text);
      else await this.replyViaTwilio(to, text);
    };

    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<void>((resolve) => {
      timer = setTimeout(resolve, TWILIO_REPLY_WINDOW_MS);
    });

    await Promise.race([this.processMessage(this.normalizeTwilioMessage(params), reply), timeout]);
    clearTimeout(timer);
    windowOpen = false;
    return replies;
  }

  private normalizeMetaMessage(message: any): IncomingMessage {
    if (message.type === 'text') {
      return { from: message.from, type: 'text', text: message.text?.body ?? '' };
    }
    if (message.type === 'image') {
      return {
        from: message.from,
        type: 'image',
        caption: message.image.caption,
        loadMedia: () => this.downloadMetaMedia(message.image.id),
      };
    }
    if (message.type === 'audio') {
      return { from: message.from, type: 'audio', loadMedia: () => this.downloadMetaMedia(message.audio.id) };
    }
    return { from: message.from, type: 'other' };
  }

  private normalizeTwilioMessage(params: Record<string, string>): IncomingMessage {
    const from = digitsOnly(params.From ?? '');
    const numMedia = Number(params.NumMedia ?? 0);
    const mediaType = params.MediaContentType0 ?? '';

    if (numMedia > 0 && mediaType.startsWith('image/')) {
      return {
        from,
        type: 'image',
        caption: params.Body || undefined,
        loadMedia: () => this.downloadTwilioMedia(params.MediaUrl0, mediaType),
      };
    }
    if (numMedia > 0 && mediaType.startsWith('audio/')) {
      return { from, type: 'audio', loadMedia: () => this.downloadTwilioMedia(params.MediaUrl0, mediaType) };
    }
    if (numMedia === 0) {
      return { from, type: 'text', text: params.Body ?? '' };
    }
    return { from, type: 'other' };
  }

  private async processMessage(message: IncomingMessage, reply: Reply) {
    await this.handleIncomingMessage(message, reply).catch(async (err) => {
      this.logger.error(`Erro processando mensagem de ${message.from}`, err);
      await reply(message.from, 'Ops, não consegui processar essa mensagem. Pode tentar de novo?').catch(() => {});
    });
  }

  private async handleIncomingMessage(message: IncomingMessage, reply: Reply) {
    const from = message.from;

    const user = await this.prisma.user.findFirst({ where: { whatsappNumber: { in: phoneVariants(from) } } });
    if (!user) {
      await reply(
        from,
        'Esse número não está vinculado a nenhuma conta PouPay. Cadastre-o em Configurações → Perfil no app.',
      );
      return;
    }

    const userContent = await this.buildUserContent(message, reply);
    if (!userContent) return;

    const session = await this.prisma.whatsappSession.findFirst({
      where: { userId: user.id, phoneNumber: from },
    });
    const history: AnthropicMessage[] = (session?.messages as any) ?? [];
    const messages: AnthropicMessage[] = [...history, { role: 'user', content: userContent }];

    const [accounts, categories, lastTransaction] = await Promise.all([
      this.prisma.account.findMany({
        where: { userId: user.id, isArchived: false },
        select: { id: true, name: true },
      }),
      this.categoriesService.findAll(user.id),
      this.findLastWhatsappTransaction(user.id),
    ]);

    const system = this.buildSystemPrompt(accounts, categories, lastTransaction);
    const tools = [CREATE_TRANSACTION_TOOL, UPDATE_LAST_TRANSACTION_TOOL, UNDO_LAST_TRANSACTION_TOOL, ...QUERY_TOOLS];
    const ask = (conversation: AnthropicMessage[]) =>
      this.anthropic.messages.create({ model: MODEL, max_tokens: 1024, system, messages: conversation, tools });

    // As idas e vindas das ferramentas de consulta ficam só nesta conversa de
    // trabalho; o histórico salvo (messages) guarda apenas o que o usuário e
    // o assistente disseram de fato.
    const working: AnthropicMessage[] = [...messages];
    let response = await ask(working);

    for (let round = 0; round < MAX_QUERY_ROUNDS; round++) {
      const toolUses = response.content.filter((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use');
      const queries = toolUses.filter((b) => QUERY_TOOL_NAMES.has(b.name));
      if (queries.length === 0 || queries.length < toolUses.length) break;

      working.push({ role: 'assistant', content: response.content });
      working.push({
        role: 'user',
        content: await Promise.all(
          queries.map(async (q) => ({
            type: 'tool_result' as const,
            tool_use_id: q.id,
            content: await this.runQueryTool(user.id, q.name, q.input as Record<string, unknown>),
          })),
        ),
      });
      response = await ask(working);
    }

    const toolUse = response.content.find(
      (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use' && !QUERY_TOOL_NAMES.has(block.name),
    );

    if (toolUse) {
      const input = toolUse.input as Record<string, unknown>;
      if (toolUse.name === 'create_transaction') {
        await this.finalizeTransaction(user.id, from, input, accounts, categories, reply);
      } else if (toolUse.name === 'update_last_transaction') {
        await this.updateLastTransaction(user.id, from, input, accounts, categories, lastTransaction, reply);
      } else if (toolUse.name === 'undo_last_transaction') {
        await this.undoLastTransaction(user.id, from, lastTransaction, reply);
      }
      if (session) await this.prisma.whatsappSession.delete({ where: { id: session.id } });
      return;
    }

    // Sem chamada de ferramenta de escrita: o texto é resposta/pergunta pro usuário.
    const textBlocks = response.content.filter((block): block is Anthropic.TextBlock => block.type === 'text');
    const textReply = textBlocks
      .map((block) => block.text)
      .join('\n')
      .trim();

    if (!textReply) {
      await reply(from, 'Não consegui buscar isso agora. Pode tentar de novo?');
      return;
    }

    const updatedMessages: AnthropicMessage[] = [...messages, { role: 'assistant', content: textBlocks }];
    if (session) {
      await this.prisma.whatsappSession.update({
        where: { id: session.id },
        data: { messages: updatedMessages as any },
      });
    } else {
      await this.prisma.whatsappSession.create({
        data: { userId: user.id, phoneNumber: from, messages: updatedMessages as any },
      });
    }

    await reply(from, textReply);
  }

  /** Executa uma ferramenta de consulta e devolve o resultado como JSON (ou {error}) pro modelo. */
  private async runQueryTool(userId: string, name: string, input: Record<string, unknown>): Promise<string> {
    try {
      return JSON.stringify(await this.queryData(userId, name, input));
    } catch (err) {
      this.logger.error(`Falha na consulta ${name}`, err);
      return JSON.stringify({ error: 'Não foi possível consultar esse dado agora.' });
    }
  }

  private async queryData(userId: string, name: string, input: Record<string, unknown>) {
    const type = input.type === 'INCOME' ? 'INCOME' : 'EXPENSE';

    if (name === 'get_month_summary') {
      const month = typeof input.month === 'number' && input.month >= 1 && input.month <= 12 ? input.month : undefined;
      const year = typeof input.year === 'number' && input.year >= 2000 && input.year <= 2100 ? input.year : undefined;
      const summary = await this.dashboardService.getSummary(userId, month, year);
      return {
        mes: month ?? 'atual',
        ano: year ?? 'atual',
        saldoAtualTotal: summary.currentBalance,
        receitas: summary.totalIncome,
        despesas: summary.totalExpense,
        investido: summary.totalInvested,
        quantoSobrou: summary.leftovers,
        variacaoVsMesAnteriorPct: summary.comparison,
      };
    }

    if (name === 'get_spending_by_category') {
      const report = await this.reportsService.getByCategory(
        userId,
        parseIsoDate(input.startDate),
        parseIsoDate(input.endDate),
        type,
      );
      return {
        de: report.startDate,
        ate: report.endDate,
        tipo: report.type,
        total: report.total,
        categorias: report.items.slice(0, 10).map((i) => ({ nome: i.name, valor: i.amount, percentual: i.percentage })),
      };
    }

    if (name === 'search_transactions') {
      const today = todayInBrazil();
      const start = parseIsoDate(input.startDate) ?? `${today.slice(0, 8)}01`;
      const end = parseIsoDate(input.endDate) ?? today;
      const where = {
        userId,
        status: 'PAID' as const,
        type: type as 'INCOME' | 'EXPENSE',
        date: { gte: new Date(`${start}T00:00:00.000Z`), lte: new Date(`${end}T23:59:59.999Z`) },
        ...(typeof input.categoryId === 'string' && input.categoryId ? { categoryId: input.categoryId } : {}),
        ...(typeof input.text === 'string' && input.text.trim()
          ? { description: { contains: input.text.trim(), mode: 'insensitive' as const } }
          : {}),
      };

      const [agg, recent] = await Promise.all([
        this.prisma.transaction.aggregate({ where, _sum: { amount: true }, _count: true }),
        this.prisma.transaction.findMany({
          where,
          orderBy: { date: 'desc' },
          take: 8,
          select: { description: true, amount: true, date: true, category: { select: { name: true } } },
        }),
      ]);

      return {
        de: start,
        ate: end,
        tipo: type,
        total: Number(agg._sum.amount ?? 0),
        quantidade: agg._count,
        ultimos: recent.map((t) => ({
          descricao: t.description,
          valor: Number(t.amount),
          data: t.date.toISOString().slice(0, 10),
          categoria: t.category?.name ?? null,
        })),
      };
    }

    if (name === 'get_account_balances') {
      const accounts = await this.prisma.account.findMany({
        where: { userId, isArchived: false },
        select: { name: true, type: true, currentBalance: true },
      });
      return accounts.map((a) => ({ conta: a.name, tipo: a.type, saldo: Number(a.currentBalance) }));
    }

    return { error: 'Consulta desconhecida' };
  }

  private async finalizeTransaction(
    userId: string,
    from: string,
    input: Record<string, unknown>,
    accounts: { id: string; name: string }[],
    categories: { id: string; name: string }[],
    reply: Reply,
  ) {
    const type = input.type === 'INCOME' ? 'INCOME' : input.type === 'EXPENSE' ? 'EXPENSE' : null;
    const description = typeof input.description === 'string' ? input.description : null;
    const amount = typeof input.amount === 'number' ? input.amount : Number(input.amount);
    const account = accounts.find((a) => a.id === input.accountId);
    const category = typeof input.categoryId === 'string' ? categories.find((c) => c.id === input.categoryId) : undefined;
    const status = input.status === 'PENDING' ? 'PENDING' : 'PAID';
    const date = typeof input.date === 'string' && input.date ? input.date : todayInBrazil();

    // Validação defensiva: nunca confia cegamente no que o modelo mandou —
    // conta/categoria precisam ser exatamente uma das que pertencem ao usuário.
    if (!type || !description || !amount || amount <= 0 || !account) {
      await reply(from, 'Não consegui confirmar os dados do lançamento. Pode reenviar com mais detalhes?');
      return;
    }

    await this.transactionsService.create(userId, {
      type: type as 'INCOME' | 'EXPENSE',
      description,
      amount,
      accountId: account.id,
      categoryId: category?.id,
      status: status as 'PAID' | 'PENDING',
      date: `${date}T12:00:00.000Z`,
      notes: WHATSAPP_NOTE,
    });

    const parts = [description, formatBRL(amount), account.name, category?.name].filter(Boolean);
    await reply(from, `✅ Lançado: ${parts.join(' — ')}\n${RECEIPT_FOOTER}`);
  }

  /** Último lançamento feito por aqui nas últimas 24h (é o único editável/desfazível). */
  private async findLastWhatsappTransaction(userId: string): Promise<LastTransaction | null> {
    const tx = await this.prisma.transaction.findFirst({
      where: {
        userId,
        notes: WHATSAPP_NOTE,
        createdAt: { gte: new Date(Date.now() - RECEIPT_WINDOW_MS) },
      },
      orderBy: { createdAt: 'desc' },
      include: { account: { select: { name: true } }, category: { select: { name: true } } },
    });
    if (!tx) return null;

    return {
      id: tx.id,
      type: tx.type,
      description: tx.description,
      amount: Number(tx.amount),
      date: tx.date,
      status: tx.status,
      accountName: tx.account?.name ?? null,
      categoryName: tx.category?.name ?? null,
    };
  }

  private async undoLastTransaction(
    userId: string,
    from: string,
    last: LastTransaction | null,
    reply: Reply,
  ) {
    if (!last) {
      await reply(from, 'Não achei nenhum lançamento feito por aqui nas últimas 24h pra desfazer.');
      return;
    }

    await this.transactionsService.remove(last.id, userId);
    const parts = [last.description, formatBRL(last.amount), last.accountName].filter(Boolean);
    await reply(from, `↩️ Desfeito: ${parts.join(' — ')}`);
  }

  private async updateLastTransaction(
    userId: string,
    from: string,
    input: Record<string, unknown>,
    accounts: NamedItem[],
    categories: NamedItem[],
    last: LastTransaction | null,
    reply: Reply,
  ) {
    if (!last) {
      await reply(from, 'Não achei nenhum lançamento feito por aqui nas últimas 24h pra corrigir.');
      return;
    }

    // Mesma validação defensiva do create: conta/categoria só se forem do usuário.
    const dto: Record<string, unknown> = {};
    const changes: string[] = [];

    const amount = typeof input.amount === 'number' ? input.amount : Number(input.amount);
    if (input.amount !== undefined && amount > 0 && amount !== last.amount) {
      dto.amount = amount;
      changes.push(`valor: ${formatBRL(last.amount)} → ${formatBRL(amount)}`);
    }
    if (typeof input.description === 'string' && input.description && input.description !== last.description) {
      dto.description = input.description;
      changes.push(`descrição: ${last.description} → ${input.description}`);
    }
    const account = accounts.find((a) => a.id === input.accountId);
    if (account && account.name !== last.accountName) {
      dto.accountId = account.id;
      changes.push(`conta: ${last.accountName ?? '—'} → ${account.name}`);
    }
    const category = categories.find((c) => c.id === input.categoryId);
    if (category && category.name !== last.categoryName) {
      dto.categoryId = category.id;
      changes.push(`categoria: ${last.categoryName ?? '—'} → ${category.name}`);
    }
    if (typeof input.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input.date)) {
      dto.date = `${input.date}T12:00:00.000Z`;
      changes.push(`data: ${input.date.split('-').reverse().join('/')}`);
    }
    if (input.status === 'PAID' || input.status === 'PENDING') {
      if (input.status !== last.status) {
        dto.status = input.status;
        changes.push(`status: ${input.status === 'PAID' ? 'pago' : 'pendente'}`);
      }
    }

    if (changes.length === 0) {
      await reply(from, 'Não entendi o que mudar. Diga, por exemplo: "o valor é 25" ou "era na conta Inter".');
      return;
    }

    await this.transactionsService.update(last.id, userId, dto);
    await reply(from, `✏️ Corrigido (${last.description}):\n• ${changes.join('\n• ')}`);
  }

  private buildSystemPrompt(
    accounts: { id: string; name: string }[],
    categories: { id: string; name: string }[],
    lastTransaction: LastTransaction | null,
  ): string {
    const accountsList = accounts.map((a) => `- ${a.name} (id: ${a.id})`).join('\n') || '(nenhuma conta cadastrada)';
    const categoriesList = categories.map((c) => `- ${c.name} (id: ${c.id})`).join('\n') || '(nenhuma categoria cadastrada)';

    return `Você é o assistente financeiro do PouPay, conversando por WhatsApp pra registrar um gasto ou receita que o usuário te manda por texto ou foto de comprovante.

Contas disponíveis:
${accountsList}

Categorias disponíveis:
${categoriesList}

Data de hoje: ${todayInBrazil()}

${
  lastTransaction
    ? `Último lançamento feito por aqui (ainda corrigível por 24h): ${lastTransaction.description}, ${formatBRL(lastTransaction.amount)}, conta ${lastTransaction.accountName ?? 'sem conta'}, categoria ${lastTransaction.categoryName ?? 'sem categoria'}, status ${lastTransaction.status}.`
    : 'Nenhum lançamento recente feito por aqui (nada pra corrigir ou desfazer).'
}

Regras:
- Se vier uma foto de comprovante, leia dela o valor, o estabelecimento/descrição e a data.
- Categoria é opcional — use se ficar óbvio pela descrição, senão deixe de fora.
- Conta é obrigatória. Se houver mais de uma conta e não estiver claro qual usar, PERGUNTE antes de chamar a ferramenta (responda só com texto, sem tool call).
- Se faltar o valor ou a descrição, pergunte.
- Assim que tiver tipo, descrição, valor e conta definidos, chame create_transaction — não peça confirmação por texto antes, a confirmação final quem manda é o sistema depois de lançar.
- Se o usuário disser que errou algo do último lançamento ("o valor é 25", "era na Inter", "na verdade foi ontem"), chame update_last_transaction só com o que muda. Se pedir pra desfazer/cancelar/apagar o que acabou de lançar, chame undo_last_transaction. Essas duas só valem pro último lançamento acima; qualquer outro lançamento só se mexe pelo app.
- Perguntas sobre gastos, receitas, saldo ou "quanto sobrou" se respondem com as ferramentas de consulta (get_month_summary, get_spending_by_category, search_transactions, get_account_balances). Nunca invente ou estime valores: use só o que a ferramenta devolveu. Datas sempre AAAA-MM-DD; "esse mês" = do dia 1 até hoje; "mês passado" = o mês anterior inteiro. Só lançamentos já pagos entram nas consultas; diga isso se for relevante. Valores em reais (R$ 1.234,56).
- Respostas em português, curtas e diretas (é WhatsApp).`;
  }

  private async buildUserContent(message: IncomingMessage, reply: Reply): Promise<Anthropic.ContentBlockParam[] | null> {
    if (message.type === 'text') {
      return [{ type: 'text', text: message.text ?? '' }];
    }

    if (message.type === 'image' && message.loadMedia) {
      const { data, mimeType } = await message.loadMedia();
      const content: Anthropic.ContentBlockParam[] = [
        {
          type: 'image',
          source: { type: 'base64', media_type: mimeType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp', data },
        },
      ];
      if (message.caption) content.push({ type: 'text', text: message.caption });
      return content;
    }

    if (message.type === 'audio' && message.loadMedia) {
      if (!isTranscriptionConfigured()) {
        await reply(message.from, 'Ainda não consigo ouvir áudios por aqui. Manda por texto ou foto do comprovante 🙂');
        return null;
      }

      const { data, mimeType } = await message.loadMedia();
      const transcript = await transcribeAudio(Buffer.from(data, 'base64'), mimeType);
      if (!transcript) {
        await reply(message.from, 'Não consegui entender o áudio. Pode repetir ou mandar por texto?');
        return null;
      }
      return [{ type: 'text', text: transcript }];
    }

    await reply(message.from, 'Por enquanto eu só entendo texto, áudio ou foto do comprovante 🙂');
    return null;
  }

  private async downloadMetaMedia(mediaId: string): Promise<{ data: string; mimeType: string }> {
    const token = process.env.WHATSAPP_ACCESS_TOKEN;
    const metaRes = await fetch(`${GRAPH_API_URL}/${mediaId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const meta = await metaRes.json();

    const fileRes = await fetch(meta.url, { headers: { Authorization: `Bearer ${token}` } });
    const buffer = Buffer.from(await fileRes.arrayBuffer());

    return { data: buffer.toString('base64'), mimeType: meta.mime_type };
  }

  /** Envia pela Meta. Devolve a descrição do erro, ou null se deu certo. */
  private async sendViaMeta(to: string, text: string): Promise<string | null> {
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    const token = process.env.WHATSAPP_ACCESS_TOKEN;

    const res = await fetch(`${GRAPH_API_URL}/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'text',
        text: { body: text },
      }),
    });

    return res.ok ? null : `${res.status} ${await res.text()}`;
  }

  /**
   * Envia pela API da Twilio. A Twilio entrega celulares brasileiros num
   * formato (com ou sem o 9º dígito) e às vezes só aceita o envio no outro:
   * tenta as duas formas. Devolve a descrição do último erro, ou null.
   */
  private async sendViaTwilio(to: string, text: string): Promise<string | null> {
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    const fromNumber = process.env.TWILIO_WHATSAPP_FROM;

    let lastError = '';
    for (const number of phoneVariants(to)) {
      const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: 'Basic ' + Buffer.from(`${sid}:${token}`).toString('base64'),
        },
        body: new URLSearchParams({
          From: `whatsapp:${fromNumber}`,
          To: `whatsapp:+${number}`,
          Body: text,
        }),
      });

      if (res.ok) return null;
      lastError = `${number}: ${res.status} ${await res.text()}`;
    }
    return lastError;
  }

  private replyViaMeta: Reply = async (to, text) => {
    const error = await this.sendViaMeta(to, text);
    if (error) this.logger.error(`Falha ao enviar mensagem WhatsApp (Meta) para ${to}: ${error}`);
  };

  private replyViaTwilio: Reply = async (to, text) => {
    const error = await this.sendViaTwilio(to, text);
    if (error) this.logger.error(`Falha ao enviar mensagem WhatsApp (Twilio) para ${to} — ${error}`);
  };

  /**
   * Mensagem iniciada pelo sistema (resumo diário). Usa a Twilio se ela
   * estiver configurada, senão a Meta. Fora da janela de 24h o WhatsApp
   * recusa texto livre (exige template aprovado) — nesse caso devolve false.
   */
  async sendProactiveMessage(to: string, text: string): Promise<boolean> {
    const useTwilio = Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN);
    const error = await (useTwilio ? this.sendViaTwilio(to, text) : this.sendViaMeta(to, text)).catch(
      (err: Error) => err.message,
    );
    if (error) {
      this.logger.error(`Falha ao enviar aviso WhatsApp (${useTwilio ? 'Twilio' : 'Meta'}) para ${to}: ${error}`);
      return false;
    }
    return true;
  }

  private async downloadTwilioMedia(url: string, mimeType: string): Promise<{ data: string; mimeType: string }> {
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    const res = await fetch(url, {
      headers: { Authorization: 'Basic ' + Buffer.from(`${sid}:${token}`).toString('base64') },
    });
    const buffer = Buffer.from(await res.arrayBuffer());
    return { data: buffer.toString('base64'), mimeType };
  }
}
