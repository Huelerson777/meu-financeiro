import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import Anthropic from '@anthropic-ai/sdk';
import { PrismaService } from '../common/prisma/prisma.service';
import { TransactionsService } from '../transactions/transactions.service';
import { CategoriesService } from '../categories/categories.service';
import { CREATE_TRANSACTION_TOOL } from './create-transaction-tool';

const GRAPH_API_VERSION = 'v20.0';
const GRAPH_API_URL = `https://graph.facebook.com/${GRAPH_API_VERSION}`;
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5-20251001';

type AnthropicMessage = { role: 'user' | 'assistant'; content: Anthropic.ContentBlockParam[] };

@Injectable()
export class WhatsappService {
  private readonly logger = new Logger(WhatsappService.name);
  private readonly anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  constructor(
    private prisma: PrismaService,
    private transactionsService: TransactionsService,
    private categoriesService: CategoriesService,
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

  async handleWebhookPayload(body: any) {
    const entries = body?.entry ?? [];
    for (const entry of entries) {
      for (const change of entry.changes ?? []) {
        const messages = change.value?.messages ?? [];
        for (const message of messages) {
          await this.handleIncomingMessage(message).catch(async (err) => {
            this.logger.error(`Erro processando mensagem de ${message.from}`, err);
            await this.sendWhatsappMessage(
              message.from,
              'Ops, não consegui processar essa mensagem. Pode tentar de novo?',
            ).catch(() => {});
          });
        }
      }
    }
  }

  private async handleIncomingMessage(message: any) {
    const from = message.from as string;

    const user = await this.prisma.user.findUnique({ where: { whatsappNumber: from } });
    if (!user) {
      await this.sendWhatsappMessage(
        from,
        'Esse número não está vinculado a nenhuma conta FinanceFlow. Cadastre-o em Configurações → Perfil no app.',
      );
      return;
    }

    const userContent = await this.buildUserContent(message);
    if (!userContent) return;

    const session = await this.prisma.whatsappSession.findFirst({
      where: { userId: user.id, phoneNumber: from },
    });
    const history: AnthropicMessage[] = (session?.messages as any) ?? [];
    const messages: AnthropicMessage[] = [...history, { role: 'user', content: userContent }];

    const [accounts, categories] = await Promise.all([
      this.prisma.account.findMany({
        where: { userId: user.id, isArchived: false },
        select: { id: true, name: true },
      }),
      this.categoriesService.findAll(user.id),
    ]);

    const response = await this.anthropic.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: this.buildSystemPrompt(accounts, categories),
      messages,
      tools: [CREATE_TRANSACTION_TOOL],
    });

    const toolUse = response.content.find(
      (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use',
    );

    if (toolUse && toolUse.name === 'create_transaction') {
      await this.finalizeTransaction(user.id, from, toolUse.input as Record<string, unknown>, accounts, categories);
      if (session) await this.prisma.whatsappSession.delete({ where: { id: session.id } });
      return;
    }

    // Sem chamada de ferramenta: o texto é uma pergunta/comentário pro usuário.
    const updatedMessages: AnthropicMessage[] = [...messages, { role: 'assistant', content: response.content }];
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

    const textReply = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('\n')
      .trim();

    if (textReply) await this.sendWhatsappMessage(from, textReply);
  }

  private async finalizeTransaction(
    userId: string,
    from: string,
    input: Record<string, unknown>,
    accounts: { id: string; name: string }[],
    categories: { id: string; name: string }[],
  ) {
    const type = input.type === 'INCOME' ? 'INCOME' : input.type === 'EXPENSE' ? 'EXPENSE' : null;
    const description = typeof input.description === 'string' ? input.description : null;
    const amount = typeof input.amount === 'number' ? input.amount : Number(input.amount);
    const account = accounts.find((a) => a.id === input.accountId);
    const category = typeof input.categoryId === 'string' ? categories.find((c) => c.id === input.categoryId) : undefined;
    const status = input.status === 'PENDING' ? 'PENDING' : 'PAID';
    const date = typeof input.date === 'string' && input.date ? input.date : new Date().toISOString().split('T')[0];

    // Validação defensiva: nunca confia cegamente no que o modelo mandou —
    // conta/categoria precisam ser exatamente uma das que pertencem ao usuário.
    if (!type || !description || !amount || amount <= 0 || !account) {
      await this.sendWhatsappMessage(from, 'Não consegui confirmar os dados do lançamento. Pode reenviar com mais detalhes?');
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
    });

    const amountLabel = amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    const parts = [description, amountLabel, account.name, category?.name].filter(Boolean);
    await this.sendWhatsappMessage(from, `✅ Lançado: ${parts.join(' — ')}`);
  }

  private buildSystemPrompt(
    accounts: { id: string; name: string }[],
    categories: { id: string; name: string }[],
  ): string {
    const accountsList = accounts.map((a) => `- ${a.name} (id: ${a.id})`).join('\n') || '(nenhuma conta cadastrada)';
    const categoriesList = categories.map((c) => `- ${c.name} (id: ${c.id})`).join('\n') || '(nenhuma categoria cadastrada)';

    return `Você é o assistente financeiro do FinanceFlow, conversando por WhatsApp pra registrar um gasto ou receita que o usuário te manda por texto ou foto de comprovante.

Contas disponíveis:
${accountsList}

Categorias disponíveis:
${categoriesList}

Data de hoje: ${new Date().toISOString().split('T')[0]}

Regras:
- Se vier uma foto de comprovante, leia dela o valor, o estabelecimento/descrição e a data.
- Categoria é opcional — use se ficar óbvio pela descrição, senão deixe de fora.
- Conta é obrigatória. Se houver mais de uma conta e não estiver claro qual usar, PERGUNTE antes de chamar a ferramenta (responda só com texto, sem tool call).
- Se faltar o valor ou a descrição, pergunte.
- Assim que tiver tipo, descrição, valor e conta definidos, chame create_transaction — não peça confirmação por texto antes, a confirmação final quem manda é o sistema depois de lançar.
- Respostas em português, curtas e diretas (é WhatsApp).`;
  }

  private async buildUserContent(message: any): Promise<Anthropic.ContentBlockParam[] | null> {
    if (message.type === 'text') {
      return [{ type: 'text', text: message.text?.body ?? '' }];
    }

    if (message.type === 'image') {
      const { data, mimeType } = await this.downloadMedia(message.image.id);
      const content: Anthropic.ContentBlockParam[] = [
        {
          type: 'image',
          source: { type: 'base64', media_type: mimeType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp', data },
        },
      ];
      if (message.image.caption) content.push({ type: 'text', text: message.image.caption });
      return content;
    }

    await this.sendWhatsappMessage(message.from, 'Por enquanto eu só entendo texto ou foto do comprovante 🙂');
    return null;
  }

  private async downloadMedia(mediaId: string): Promise<{ data: string; mimeType: string }> {
    const token = process.env.WHATSAPP_ACCESS_TOKEN;
    const metaRes = await fetch(`${GRAPH_API_URL}/${mediaId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const meta = await metaRes.json();

    const fileRes = await fetch(meta.url, { headers: { Authorization: `Bearer ${token}` } });
    const buffer = Buffer.from(await fileRes.arrayBuffer());

    return { data: buffer.toString('base64'), mimeType: meta.mime_type };
  }

  private async sendWhatsappMessage(to: string, text: string) {
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

    if (!res.ok) {
      this.logger.error(`Falha ao enviar mensagem WhatsApp para ${to}: ${res.status} ${await res.text()}`);
    }
  }
}
