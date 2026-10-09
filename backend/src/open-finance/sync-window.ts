const DAY_MS = 24 * 3600 * 1000;

// Reprocessa uma janela antes da última sincronização: lançamentos pendentes no banco só aparecem depois.
export const OVERLAP_DAYS = 7;

/**
 * Data a partir da qual buscar na Pluggy. A janela de sobreposição nunca recua além de `startsAt`:
 * o que veio antes da ligação já foi lançado à mão e importá-lo duplicaria lançamentos e saldo.
 */
export function syncFrom(startsAt: Date, lastSyncAt: Date | null): Date {
  if (!lastSyncAt) return startsAt;
  const overlapped = new Date(lastSyncAt.getTime() - OVERLAP_DAYS * DAY_MS);
  return overlapped > startsAt ? overlapped : startsAt;
}
