import { deliverTokens, readRefreshCookie, usesCookieTransport, REFRESH_COOKIE_NAME } from './refresh-cookie';

const req = (headers: Record<string, string> = {}) => ({ headers }) as any;
const res = () => ({ cookie: jest.fn(), clearCookie: jest.fn() }) as any;

describe('refresh-cookie', () => {
  it('lê o refresh token do header Cookie entre outros cookies', () => {
    expect(readRefreshCookie(req({ cookie: `a=1; ${REFRESH_COOKIE_NAME}=abc%20d; b=2` }))).toBe('abc d');
    expect(readRefreshCookie(req({ cookie: 'a=1' }))).toBeUndefined();
    expect(readRefreshCookie(req())).toBeUndefined();
  });

  it('detecta o transporte por cookie pelo header', () => {
    expect(usesCookieTransport(req({ 'x-token-transport': 'cookie' }))).toBe(true);
    expect(usesCookieTransport(req())).toBe(false);
  });

  it('modo cookie: grava httpOnly e remove refreshToken do corpo', () => {
    const r = res();
    const body = deliverTokens(req({ 'x-token-transport': 'cookie' }), r, { accessToken: 'a', refreshToken: 'r' });
    expect(body).toEqual({ accessToken: 'a' });
    expect(r.cookie).toHaveBeenCalledWith(
      REFRESH_COOKIE_NAME,
      'r',
      expect.objectContaining({ httpOnly: true, sameSite: 'lax', maxAge: 7 * 24 * 60 * 60 * 1000 }),
    );
  });

  it('modo legado: mantém refreshToken no corpo (compatibilidade)', () => {
    const body = deliverTokens(req(), res(), { accessToken: 'a', refreshToken: 'r' }, 28);
    expect(body).toEqual({ accessToken: 'a', refreshToken: 'r' });
  });
});
