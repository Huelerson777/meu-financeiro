/**
 * Converte um "YYYY-MM-DD" (o formato que <input type="date"> manda) pro dia
 * local certo. `new Date('YYYY-MM-DD')` é interpretado como meia-noite UTC —
 * em fusos negativos (ex: Brasil, UTC-3) isso vira 21h do dia anterior no
 * horário local, o que troca o mês quando a data é dia 1º.
 */
export function parseDateOnly(value: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return new Date(value);
  const [, year, month, day] = match;
  return new Date(Number(year), Number(month) - 1, Number(day));
}
