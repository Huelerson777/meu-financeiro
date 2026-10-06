import { describe, expect, it } from 'vitest';
import { effectiveDate, isEffectivelyPaid } from './transaction-status';

describe('isEffectivelyPaid', () => {
  it('transação PAID é paga', () => expect(isEffectivelyPaid({ status: 'PAID', date: '2026-10-01' })).toBe(true));

  it('parcela paga conta como paga mesmo com a transação PENDING (o "pago" mora na parcela)', () => {
    expect(isEffectivelyPaid({ status: 'PENDING', date: '2026-08-01', installments: [{ paid: true, paidAt: '2026-10-06' }] })).toBe(true);
  });

  it('pendente sem parcela paga continua pendente', () => {
    expect(isEffectivelyPaid({ status: 'PENDING', date: '2026-10-01', installments: [{ paid: false }] })).toBe(false);
    expect(isEffectivelyPaid({ status: 'PENDING', date: '2026-10-01' })).toBe(false);
  });
});

describe('effectiveDate', () => {
  it('usa a data do pagamento da parcela quando existir', () => {
    expect(effectiveDate({ status: 'PENDING', date: '2026-08-01', installments: [{ paid: true, paidAt: '2026-10-06' }] })).toBe('2026-10-06');
  });
  it('senão, a data do lançamento', () => {
    expect(effectiveDate({ status: 'PAID', date: '2026-10-01' })).toBe('2026-10-01');
    expect(effectiveDate({ status: 'PENDING', date: '2026-10-01', installments: [{ paid: false }] })).toBe('2026-10-01');
  });
});
