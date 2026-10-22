import { QUERY_TOOLS, QUERY_TOOL_NAMES, parseIsoDate, todayInBrazil } from './query-tools';

describe('parseIsoDate', () => {
  it('aceita datas AAAA-MM-DD válidas', () => {
    expect(parseIsoDate('2026-10-22')).toBe('2026-10-22');
    expect(parseIsoDate('2028-02-29')).toBe('2028-02-29');
  });

  it('rejeita formato errado, data inexistente e tipos que não são texto', () => {
    expect(parseIsoDate('22/10/2026')).toBeUndefined();
    expect(parseIsoDate('2026-02-30')).toBeUndefined();
    expect(parseIsoDate('2026-13-01')).toBeUndefined();
    expect(parseIsoDate(undefined)).toBeUndefined();
    expect(parseIsoDate(20261022)).toBeUndefined();
  });
});

describe('todayInBrazil', () => {
  it('usa o fuso de São Paulo, não UTC (22h em SP já é dia seguinte em UTC)', () => {
    expect(todayInBrazil(new Date('2026-10-23T01:30:00.000Z'))).toBe('2026-10-22');
    expect(todayInBrazil(new Date('2026-10-22T15:00:00.000Z'))).toBe('2026-10-22');
  });
});

describe('QUERY_TOOLS', () => {
  it('nomes únicos e só ferramentas de leitura', () => {
    expect(QUERY_TOOL_NAMES.size).toBe(QUERY_TOOLS.length);
    expect([...QUERY_TOOL_NAMES].sort()).toEqual([
      'get_account_balances',
      'get_month_summary',
      'get_spending_by_category',
      'search_transactions',
    ]);
  });
});
