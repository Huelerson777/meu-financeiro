interface InstallmentInfo {
  paid: boolean;
  paidAt?: string | null;
}

interface StatusLike {
  status: string;
  date: string;
  installments?: InstallmentInfo[] | null;
}

/**
 * Parcelas (de cartão ou financiamentos) guardam o "pago" na própria parcela, e o
 * status da transação continua PENDING — então o pago de verdade é um OU o outro.
 */
export function isEffectivelyPaid(t: StatusLike): boolean {
  return t.status === 'PAID' || !!t.installments?.some((i) => i.paid);
}

/** Data em que a coisa de fato aconteceu: pagamento da parcela, quando existir; senão a data do lançamento. */
export function effectiveDate(t: StatusLike): string {
  const paidAt = t.installments?.find((i) => i.paid && i.paidAt)?.paidAt;
  return paidAt ?? t.date;
}
