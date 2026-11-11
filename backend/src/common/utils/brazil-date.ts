/**
 * Hoje (AAAA-MM-DD) no fuso do usuário, não o do servidor. O servidor roda em
 * UTC: depois das 21h em Brasília, `new Date().toISOString()` já devolve o
 * dia seguinte.
 */
export function todayInBrazil(now: Date = new Date()): string {
  return now.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
}
