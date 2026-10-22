import type Anthropic from '@anthropic-ai/sdk';

/**
 * Ferramentas só de leitura do WhatsApp: o modelo pede o dado, o serviço
 * executa e devolve como tool_result pra ele redigir a resposta. Diferente das
 * ferramentas de escrita (criar/corrigir/desfazer), que encerram a conversa.
 */
export const QUERY_TOOLS: Anthropic.Tool[] = [
  {
    name: 'get_month_summary',
    description:
      'Resumo de um mês: saldo atual, receitas, despesas, investido, quanto sobrou e variação % vs. mês anterior. Use para "quanto sobrou?", "como estou esse mês?", "compara com o mês passado". Sem parâmetros = mês atual.',
    input_schema: {
      type: 'object',
      properties: {
        month: { type: 'number', description: 'Mês de 1 a 12. Padrão: mês atual.' },
        year: { type: 'number', description: 'Ano com 4 dígitos. Padrão: ano atual.' },
      },
    },
  },
  {
    name: 'get_spending_by_category',
    description:
      'Total por categoria num período (só lançamentos já pagos), do maior pro menor, com percentual. Use para "onde estou gastando mais?" ou "quanto foi de mercado em agosto?" quando a pergunta é sobre uma categoria.',
    input_schema: {
      type: 'object',
      properties: {
        startDate: { type: 'string', description: 'Início AAAA-MM-DD. Padrão: dia 1 do mês atual.' },
        endDate: { type: 'string', description: 'Fim AAAA-MM-DD (inclusive). Padrão: último dia do mês atual.' },
        type: { type: 'string', enum: ['EXPENSE', 'INCOME'], description: 'EXPENSE (padrão) ou INCOME' },
      },
    },
  },
  {
    name: 'search_transactions',
    description:
      'Soma, quantidade e últimos lançamentos que batem com um filtro (só já pagos). Use para "quanto gastei no iFood?", "quanto foi de uber esse mês?", "quais foram meus últimos gastos?". Filtre por texto na descrição e/ou categoria.',
    input_schema: {
      type: 'object',
      properties: {
        startDate: { type: 'string', description: 'Início AAAA-MM-DD. Padrão: dia 1 do mês atual.' },
        endDate: { type: 'string', description: 'Fim AAAA-MM-DD (inclusive). Padrão: hoje.' },
        text: { type: 'string', description: 'Trecho da descrição, ex: "ifood", "uber"' },
        categoryId: { type: 'string', description: 'id de uma das categorias da lista de categorias disponíveis' },
        type: { type: 'string', enum: ['EXPENSE', 'INCOME'], description: 'EXPENSE (padrão) ou INCOME' },
      },
    },
  },
  {
    name: 'get_account_balances',
    description: 'Saldo atual de cada conta ativa. Use para "quanto tenho na Inter?" ou "qual meu saldo?".',
    input_schema: { type: 'object', properties: {} },
  },
];

export const QUERY_TOOL_NAMES = new Set(QUERY_TOOLS.map((t) => t.name));

/** Máximo de idas e vindas de consulta por mensagem (evita laço infinito e custo). */
export const MAX_QUERY_ROUNDS = 4;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Aceita só AAAA-MM-DD válido; qualquer outra coisa vira undefined (usa o padrão). */
export function parseIsoDate(value: unknown): string | undefined {
  if (typeof value !== 'string' || !DATE_RE.test(value)) return undefined;
  const d = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== value ? undefined : value;
}

/** Hoje (AAAA-MM-DD) no fuso do usuário, não o do servidor (UTC). */
export function todayInBrazil(now: Date = new Date()): string {
  return now.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
}
