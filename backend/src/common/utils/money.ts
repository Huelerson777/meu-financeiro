/**
 * Maior valor que cabe nas colunas Decimal(14, 2) do banco. Acima disso o
 * Postgres recusa a gravação e a API responderia 500 em vez de um erro de
 * validação claro.
 */
export const MAX_MONEY_AMOUNT = 999_999_999_999.99;
