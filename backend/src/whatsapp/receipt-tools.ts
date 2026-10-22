import type Anthropic from '@anthropic-ai/sdk';

/**
 * Marca gravada em `transactions.notes` nos lançamentos feitos pelo WhatsApp.
 * É por ela que o "último lançamento" editável/desfazível é localizado — sem
 * tabela nova, e já serve de rastro pra quem olha a transação no app.
 */
export const WHATSAPP_NOTE = 'Lançado via WhatsApp';

/** Por quanto tempo o recibo aceita "desfazer"/corrigir. */
export const RECEIPT_WINDOW_MS = 24 * 60 * 60 * 1000;

export const UPDATE_LAST_TRANSACTION_TOOL: Anthropic.Tool = {
  name: 'update_last_transaction',
  description:
    'Corrige o ÚLTIMO lançamento feito por aqui (listado no prompt como "último lançamento"), quando o usuário disser que errou algo: valor, descrição, conta, categoria, data ou status. Envie só os campos que mudam. Não serve para outros lançamentos.',
  input_schema: {
    type: 'object',
    properties: {
      amount: { type: 'number', description: 'Novo valor em reais, sempre positivo' },
      description: { type: 'string', description: 'Nova descrição' },
      accountId: { type: 'string', description: 'id de uma das contas da lista de contas disponíveis' },
      categoryId: { type: 'string', description: 'id de uma das categorias da lista de categorias disponíveis' },
      date: { type: 'string', description: 'Nova data em AAAA-MM-DD' },
      status: { type: 'string', enum: ['PAID', 'PENDING'], description: 'PAID se já aconteceu, PENDING se é futuro' },
    },
  },
};

export const UNDO_LAST_TRANSACTION_TOOL: Anthropic.Tool = {
  name: 'undo_last_transaction',
  description:
    'Desfaz (apaga) o ÚLTIMO lançamento feito por aqui, quando o usuário pedir para desfazer, cancelar ou apagar o que acabou de lançar. Não serve para outros lançamentos.',
  input_schema: { type: 'object', properties: {} },
};

export function formatBRL(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/** Rodapé do recibo: avisa que dá pra corrigir ou desfazer pela conversa. */
export const RECEIPT_FOOTER = 'Errou? Responda *desfazer* ou diga o que corrigir (ex.: "o valor é 25"). Vale por 24h.';
