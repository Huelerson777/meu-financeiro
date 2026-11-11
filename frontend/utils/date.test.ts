import { describe, expect, it } from 'vitest';
import { todayLocalISO } from './date';

describe('todayLocalISO', () => {
  it('usa o dia do fuso local, não o de UTC', () => {
    // 23h30 no horário local: em UTC-3 o toISOString() já mostraria o dia seguinte.
    const lateNight = new Date(2026, 10, 11, 23, 30);
    expect(todayLocalISO(lateNight)).toBe('2026-11-11');
  });

  it('completa mês e dia com zero', () => {
    expect(todayLocalISO(new Date(2026, 0, 5, 8, 0))).toBe('2026-01-05');
  });
});
