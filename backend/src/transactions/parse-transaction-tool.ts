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
        enum: ['EXPENSE', 'INCOME', 'TRANSFER', 'INVESTMENT'],
        description:
          'EXPENSE para gasto/despesa, INCOME para receita/entrada, TRANSFER para mover dinheiro entre duas contas do usuário, INVESTMENT para um aporte que sai de uma conta e vai para uma conta de investimento.',
      },
      description: {
        type: 'string',
        description: 'Descrição curta do lançamento, ex: "Blusa Renner", "Venda de um controle", "Aporte CDB"',
      },
      amount: {
        type: 'number',
        description: 'Valor em reais, sempre positivo',
      },
      accountId: {
        type: 'string',
        description:
          'id de uma das contas informadas na lista de contas disponíveis — pagamento/recebimento por conta (débito, pix, dinheiro), ou a conta de ORIGEM quando type for TRANSFER/INVESTMENT. Não preencher junto com cardId.',
      },
      toAccountId: {
        type: 'string',
        description:
          'Só quando type for TRANSFER ou INVESTMENT: id da conta de DESTINO do dinheiro. Em INVESTMENT precisa ser uma conta do tipo investimento.',
      },
      cardId: {
        type: 'string',
        description:
          'id de um dos cartões informados na lista de cartões disponíveis — use quando o texto mencionar cartão de crédito (só se aplica a EXPENSE/INCOME). Não preencher junto com accountId.',
      },
      installmentsCount: {
        type: 'number',
        description: 'Número de parcelas, só relevante se cardId for preenchido. Padrão 1 se não for dito.',
      },
      categoryId: {
        type: 'string',
        description: 'id de uma das categorias informadas, se ficar óbvio qual usar. Não se aplica a TRANSFER/INVESTMENT.',
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
