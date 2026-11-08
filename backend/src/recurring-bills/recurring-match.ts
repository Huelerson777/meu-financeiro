const DAY_MS = 24 * 3600 * 1000;

/** Palavras que aparecem em quase todo extrato e não identificam a conta. */
const STOPWORDS = new Set([
  'pix', 'pagamento', 'pagto', 'para', 'de', 'do', 'da', 'dos', 'das', 'enviado', 'recebido', 'compra',
  'boleto', 'ted', 'doc', 'conta', 'fatura', 'debito', 'credito', 'automatico', 'transferencia', 'ltda', 'sa', 'eireli', 'me',
  'huelerson', 'laura',
]);

export function tokenize(text: string): string[] {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 3 && !STOPWORDS.has(t));
}

/**
 * Apelidos usuais: o nome que o usuário dá à conta ("Energia") quase nunca aparece no extrato,
 * que traz o nome da empresa ("CELESC DISTRIBUICAO").
 */
const ALIASES: Record<string, string[]> = {
  energia: ['celesc', 'enel', 'cpfl', 'cemig', 'copel', 'light', 'energisa', 'equatorial', 'neoenergia', 'eletropaulo', 'ceee', 'rge'],
  luz: ['celesc', 'enel', 'cpfl', 'cemig', 'copel', 'light', 'energisa', 'equatorial', 'neoenergia'],
  agua: ['casan', 'sabesp', 'copasa', 'sanepar', 'cedae', 'embasa', 'saneamento', 'samae', 'semasa'],
  internet: ['mhnet', 'vivo', 'claro', 'oi', 'tim', 'net', 'telecom', 'fibra', 'brisanet', 'desktop'],
  celular: ['tim', 'vivo', 'claro', 'oi'],
  gas: ['comgas', 'scgas', 'naturgy', 'ultragaz', 'supergasbras'],
  aluguel: ['imobiliaria', 'locacao'],
};

export interface RecurringCandidate {
  id: string;
  description: string;
  amount: number;
  date: Date;
  type: string;
}

export interface BankRow {
  description: string;
  amount: number; // sempre positivo
  type: string;
  date: Date;
}

/** Quantas "pistas" de nome a descrição do extrato compartilha com a conta recorrente. */
export function nameScore(billDescription: string, bankDescription: string): number {
  const bank = new Set(tokenize(bankDescription));
  let score = 0;
  for (const token of tokenize(billDescription)) {
    if (bank.has(token)) score += 2;
    for (const alias of ALIASES[token] ?? []) if (bank.has(alias)) score += 1;
  }
  return score;
}

/**
 * Escolhe qual lançamento recorrente em aberto o lançamento do banco quitou, ou null.
 * Exige mesmo tipo e pista de nome; aceita também valor idêntico quando só um candidato bate,
 * para contas fixas pagas via Pix a uma pessoa (ex: aluguel).
 */
export function pickRecurringMatch<T extends RecurringCandidate>(row: BankRow, candidates: T[]): T | null {
  const near = candidates.filter((c) => {
    if (c.type !== row.type) return false;
    const diff = (c.date.getTime() - row.date.getTime()) / DAY_MS;
    return diff >= -45 && diff <= 20;
  });

  const named = near
    .map((c) => ({ c, score: nameScore(c.description, row.description) }))
    .filter((x) => x.score > 0)
    .sort(
      (a, b) =>
        b.score - a.score ||
        Math.abs(a.c.amount - row.amount) - Math.abs(b.c.amount - row.amount) ||
        Math.abs(a.c.date.getTime() - row.date.getTime()) - Math.abs(b.c.date.getTime() - row.date.getTime()),
    );
  if (named.length > 0) return named[0].c;

  const sameAmount = near.filter((c) => Math.abs(c.amount - row.amount) < 0.005);
  return sameAmount.length === 1 ? sameAmount[0] : null;
}

/**
 * "YYYY-MM" (UTC) — chave do mês usada para pular uma conta fixa. As datas dos lançamentos
 * gerados por RecurringBillsService.sync são meia-noite UTC, então o mês UTC é o mês certo.
 */
export function monthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}
