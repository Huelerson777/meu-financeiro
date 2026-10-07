import { PluggyTransaction } from './pluggy.client';

export interface CardImportRow {
  externalId: string;
  date: string; // YYYY-MM-DD
  description: string;
  amount: number; // > 0 compra (valor da parcela); < 0 estorno/crédito
  installments: number;
}

interface RecurringPurchase {
  description: string;
  amount: number;
}

// Pagamento de fatura sai da conta corrente e é registrado pelo próprio PouPay: importar duplicaria.
const PAYMENT_OPERATIONS = new Set(['PAGAMENTO', 'PAGAMENTO_FATURA']);

const normalize = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

const words = (text: string) => normalize(text).split(/[^a-z0-9]+/).filter((w) => w.length >= 4);

/** Cobrança que o PouPay já lança sozinho todo mês (assinatura): mesmo valor e alguma palavra em comum. */
function matchesRecurring(t: PluggyTransaction, recurring: RecurringPurchase[]) {
  const tWords = new Set(words(t.description));
  return recurring.some(
    (r) => Math.abs(Math.abs(t.amount) - r.amount) < 0.01 && words(r.description).some((w) => tWords.has(w)),
  );
}

/**
 * Converte as transações de um cartão da Pluggy no que o PouPay deve lançar. Em cartão o sinal é o
 * oposto da conta: amount > 0 é compra, amount < 0 é pagamento ou crédito (estorno, cashback).
 * Parcelas 2/N em diante ficam de fora: a 1/N já cria o grupo inteiro, e as demais de compras
 * anteriores ao corte já foram lançadas à mão.
 */
export function toCardRows(remote: PluggyTransaction[], recurring: RecurringPurchase[]): CardImportRow[] {
  const rows: CardImportRow[] = [];
  for (const t of remote) {
    if (t.amount === 0) continue;
    if (t.operationType && PAYMENT_OPERATIONS.has(t.operationType)) continue;

    const meta = t.creditCardMetadata;
    const total = meta?.totalInstallments ?? 1;
    const number = meta?.installmentNumber ?? 1;
    if (number > 1) continue;

    if (t.amount > 0 && matchesRecurring(t, recurring)) continue;

    rows.push({
      externalId: `pluggy:${t.id}`,
      date: t.date.slice(0, 10),
      description: t.description,
      amount: t.amount,
      installments: t.amount > 0 ? Math.max(1, total) : 1,
    });
  }
  return rows;
}
