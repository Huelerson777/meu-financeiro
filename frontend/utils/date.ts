/**
 * Hoje no fuso do navegador, em "AAAA-MM-DD" (o formato do <input type="date">).
 *
 * `new Date().toISOString()` devolve a data em UTC: no Brasil (UTC-3), depois
 * das 21h isso já é o dia seguinte — e o lançamento feito à noite nascia com a
 * data de amanhã.
 */
export function todayLocalISO(now: Date = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
