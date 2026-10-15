import { calculateAccruedValue } from './accrual.util';

describe('calculateAccruedValue', () => {
  const start = new Date(2026, 0, 1);

  it('CDI a 100% compõe a série diária após a data de aporte', () => {
    const dailySeries = [
      { date: new Date(2026, 0, 2), value: 1 },
      { date: new Date(2026, 0, 3), value: 1 },
    ];
    const result = calculateAccruedValue({
      indexer: 'CDI', rate: 100, principal: 1000, startDate: start, today: new Date(2026, 0, 3), dailySeries,
    });
    expect(result).toBe(1020.1);
  });

  it('ignora taxas no dia do aporte e após hoje', () => {
    const dailySeries = [
      { date: start, value: 5 },
      { date: new Date(2026, 0, 10), value: 5 },
    ];
    const result = calculateAccruedValue({
      indexer: 'SELIC', rate: 100, principal: 1000, startDate: start, today: new Date(2026, 0, 5), dailySeries,
    });
    expect(result).toBe(1000);
  });

  it('CDI a 50% aplica metade do fator', () => {
    const dailySeries = [{ date: new Date(2026, 0, 2), value: 4 }];
    const result = calculateAccruedValue({
      indexer: 'CDI', rate: 50, principal: 1000, startDate: start, today: new Date(2026, 0, 2), dailySeries,
    });
    expect(result).toBe(1019.8);
  });

  it('PREFIXADO rende juros compostos pro-rata em dias corridos', () => {
    const result = calculateAccruedValue({
      indexer: 'PREFIXADO', rate: 10, principal: 1000, startDate: start, today: new Date(2027, 0, 1),
    });
    expect(result).toBe(1100);
  });

  it('IPCA_PLUS combina IPCA acumulado e spread anual', () => {
    const monthlySeries = [{ date: new Date(2026, 5, 1), value: 10 }];
    const result = calculateAccruedValue({
      indexer: 'IPCA_PLUS', rate: 0, principal: 1000, startDate: start, today: new Date(2026, 11, 1), monthlySeries,
    });
    expect(result).toBe(1100);
  });

  it('sem séries devolve o principal', () => {
    expect(
      calculateAccruedValue({ indexer: 'CDI', rate: 100, principal: 500, startDate: start, today: new Date(2026, 5, 1) }),
    ).toBe(500);
  });
});
