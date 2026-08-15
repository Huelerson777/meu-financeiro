import type Anthropic from '@anthropic-ai/sdk';

/**
 * Ferramenta usada pelo endpoint POST /transactions/parse (lançamento por texto
 * livre no dashboard). Diferente de CREATE_TRANSACTION_TOOL (WhatsApp), aqui a
 * chamada é sempre forçada (tool_choice) porque não há conversa — o resultado
 * vira uma prévia editável na tela, então é aceitável a IA deixar accountId,
 * cardId ou categoryId em branco quando não tiver certeza.
 */
export const PARSE_TRANSACTION_TOOL: Anthropic.Tool = {
  name: 'parse_transaction',
  description: 'Interpreta um texto livre descrevendo um gasto ou receita e extrai os campos de um lançamento.',
  input_schema: {
    type: 'object',
    properties: {
      type: {
        type: 'string',
        enum: ['EXPENSE', 'INCOME'],
        description: 'EXPENSE para gasto/despesa, INCOME para receita/entrada',
      },
      description: {
        type: 'string',
        description: 'Descrição curta do lançamento, ex: "Blusa Renner", "Venda de um controle"',
      },
      amount: {
        type: 'number',
        description: 'Valor em reais, sempre positivo',
      },
      accountId: {
        type: 'string',
        description:
          'id de uma das contas informadas na lista de contas disponíveis — use quando for um pagamento por conta (débito, pix, dinheiro). Não preencher junto com cardId.',
      },
      cardId: {
        type: 'string',
        description:
          'id de um dos cartões informados na lista de cartões disponíveis — use quando o texto mencionar cartão de crédito. Não preencher junto com accountId.',
      },
      installmentsCount: {
        type: 'number',
        description: 'Número de parcelas, só relevante se cardId for preenchido. Padrão 1 se não for dito.',
      },
      categoryId: {
        type: 'string',
        description: 'id de uma das categorias informadas, se ficar óbvio qual usar. Pode ficar de fora.',
      },
      date: {
        type: 'string',
        description: 'Data do lançamento em formato AAAA-MM-DD. Se não for dita, usa a data de hoje.',
      },
      status: {
        type: 'string',
        enum: ['PAID', 'PENDING'],
        description: 'PAID se já aconteceu (padrão), PENDING se é algo a pagar/receber no futuro',
      },
    },
    required: ['type', 'description', 'amount'],
  },
};
