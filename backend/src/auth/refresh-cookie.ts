import type { Request, Response } from 'express';

export const REFRESH_COOKIE_NAME = 'poupay_rt';

// Header que o frontend manda quando fala com a API pelo proxy do Next
// (mesma origem do site): o refresh token vai só no cookie httpOnly e sai
// do corpo da resposta. Sem o header (apps/MCP/dev direto), o contrato antigo
// — refreshToken no JSON — continua valendo.
const TRANSPORT_HEADER = 'x-token-transport';

const cookiePath = () => process.env.REFRESH_COOKIE_PATH ?? '/api-proxy/auth';

export function usesCookieTransport(req: Request): boolean {
  return req.headers[TRANSPORT_HEADER] === 'cookie';
}

export function readRefreshCookie(req: Request): string | undefined {
  const raw = req.headers.cookie;
  if (!raw) return undefined;
  for (const part of raw.split(';')) {
    const idx = part.indexOf('=');
    if (idx > 0 && part.slice(0, idx).trim() === REFRESH_COOKIE_NAME) {
      return decodeURIComponent(part.slice(idx + 1).trim());
    }
  }
  return undefined;
}

export function setRefreshCookie(res: Response, token: string, days: number) {
  res.cookie(REFRESH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: cookiePath(),
    maxAge: days * 24 * 60 * 60 * 1000,
  });
}

export function clearRefreshCookie(res: Response) {
  res.clearCookie(REFRESH_COOKIE_NAME, { path: cookiePath() });
}

/** Grava o cookie e, no modo cookie, tira o refreshToken do corpo. */
export function deliverTokens<T extends { refreshToken: string }>(
  req: Request,
  res: Response,
  tokens: T,
  days = 7,
): T | Omit<T, 'refreshToken'> {
  setRefreshCookie(res, tokens.refreshToken, days);
  if (!usesCookieTransport(req)) return tokens;
  const { refreshToken: _omit, ...rest } = tokens;
  return rest;
}
