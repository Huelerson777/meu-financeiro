import { syncFrom } from './sync-window';

describe('syncFrom', () => {
  const startsAt = new Date('2026-10-07T03:00:00.000Z');

  it('sem sincronização anterior começa no corte da ligação', () => {
    expect(syncFrom(startsAt, null)).toEqual(startsAt);
  });

  it('a sobreposição de 7 dias nunca recua além do corte da ligação', () => {
    const lastSyncAt = new Date('2026-10-08T23:56:00.000Z');
    expect(syncFrom(startsAt, lastSyncAt)).toEqual(startsAt);
  });

  it('depois de uma semana, volta 7 dias a partir da última sincronização', () => {
    const lastSyncAt = new Date('2026-10-20T12:00:00.000Z');
    expect(syncFrom(startsAt, lastSyncAt)).toEqual(new Date('2026-10-13T12:00:00.000Z'));
  });
});
