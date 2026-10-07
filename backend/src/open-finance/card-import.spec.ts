import { toCardRows } from './card-import';
import { PluggyTransaction } from './pluggy.client';

const tx = (over: Partial<PluggyTransaction>): PluggyTransaction => ({
  id: 't1',
  description: 'Mercado Central',
  amount: 50,
  date: '2026-10-07T00:00:00.000Z',
  type: 'DEBIT',
  status: 'POSTED',
  ...over,
});

describe('toCardRows', () => {
  it('importa compra à vista como compra de 1 parcela', () => {
    expect(toCardRows([tx({})], [])).toEqual([
      { externalId: 'pluggy:t1', date: '2026-10-07', description: 'Mercado Central', amount: 50, installments: 1 },
    ]);
  });

  it('ignora pagamento de fatura', () => {
    const rows = toCardRows(
      [tx({ id: 'p1', amount: -300, operationType: 'PAGAMENTO_FATURA' }), tx({ id: 'p2', amount: -10, operationType: 'PAGAMENTO' })],
      [],
    );
    expect(rows).toEqual([]);
  });

  it('importa estorno (valor negativo) como crédito', () => {
    const rows = toCardRows([tx({ id: 'e1', amount: -25.9, operationType: 'ESTORNO', type: 'CREDIT' })], []);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ externalId: 'pluggy:e1', amount: -25.9, installments: 1 });
  });

  it('parcela 1/N cria a compra com N parcelas; 2/N em diante é ignorada', () => {
    const rows = toCardRows(
      [
        tx({ id: 'a', amount: 100, creditCardMetadata: { installmentNumber: 1, totalInstallments: 4 } }),
        tx({ id: 'b', amount: 100, creditCardMetadata: { installmentNumber: 2, totalInstallments: 4 } }),
      ],
      [],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ externalId: 'pluggy:a', amount: 100, installments: 4 });
  });

  it('ignora cobrança que bate com assinatura recorrente (mesmo valor e palavra em comum)', () => {
    const recurring = [{ description: 'Apple iCloud', amount: 14.9 }];
    const rows = toCardRows(
      [tx({ id: 'r1', description: 'APPLE.COM/BILL', amount: 14.9 }), tx({ id: 'r2', description: 'Apple Store acessório', amount: 99 })],
      recurring,
    );
    expect(rows.map((r) => r.externalId)).toEqual(['pluggy:r2']);
  });

  it('não confunde valor igual sem palavra em comum com assinatura', () => {
    const rows = toCardRows([tx({ id: 'x', description: 'Padaria', amount: 14.9 })], [{ description: 'Netflix', amount: 14.9 }]);
    expect(rows).toHaveLength(1);
  });
});
