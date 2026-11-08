import { monthKey, nameScore, pickRecurringMatch } from './recurring-match';

const d = (s: string) => new Date(`${s}T00:00:00Z`);
const open = [
  { id: 'energia', description: 'Energia', amount: 303.55, date: d('2026-11-10'), type: 'EXPENSE' },
  { id: 'internet', description: 'Internet', amount: 118.56, date: d('2026-11-10'), type: 'EXPENSE' },
  { id: 'tim', description: 'Tim Huelerson', amount: 47.99, date: d('2026-11-10'), type: 'EXPENSE' },
  { id: 'aluguel', description: 'Aluguel', amount: 2785, date: d('2026-11-10'), type: 'EXPENSE' },
  { id: 'futebol', description: 'Futebol Huelerson', amount: 80, date: d('2026-11-10'), type: 'EXPENSE' },
];
const row = (description: string, amount: number, type = 'EXPENSE') => ({ description, amount, type, date: d('2026-11-06') });

describe('recurring-match', () => {
  it('casa a conta de energia pelo nome da concessionária, ignorando a diferença de valor', () => {
    expect(pickRecurringMatch(row('Pagamento para CELESC DISTRIBUICAO S.A', 245.65), open)?.id).toBe('energia');
  });
  it('casa internet pelo provedor e Tim pelo nome', () => {
    expect(pickRecurringMatch(row('Pagamento para MHNET TELECOM', 119.9), open)?.id).toBe('internet');
    expect(pickRecurringMatch(row('Pix enviado para Tim S A', 47.99), open)?.id).toBe('tim');
  });
  it('casa Pix a uma pessoa só quando o valor é idêntico e único (aluguel)', () => {
    expect(pickRecurringMatch(row('Pix enviado para Nicodemo Luiz Brezolin', 2785), open)?.id).toBe('aluguel');
    expect(pickRecurringMatch(row('Pix enviado para Nicodemo Luiz Brezolin', 2770), open)).toBeNull();
  });
  it('não baixa conta com gasto qualquer, nem de tipo diferente', () => {
    expect(pickRecurringMatch(row('Pix enviado para Carolina Meneguzzo', 25), open)).toBeNull();
    expect(pickRecurringMatch(row('Salário recebido', 303.55, 'INCOME'), open)).toBeNull();
  });
  it('ignora pendentes muito distantes da data', () => {
    const far = [{ ...open[0], date: d('2027-02-10') }];
    expect(pickRecurringMatch(row('CELESC', 245.65), far)).toBeNull();
  });
  it('nameScore e monthKey', () => {
    expect(nameScore('Energia', 'CELESC DISTRIBUICAO')).toBeGreaterThan(0);
    expect(nameScore('Futebol', 'Mercado Livre')).toBe(0);
    expect(monthKey(d('2026-11-01'))).toBe('2026-11');
  });
});
