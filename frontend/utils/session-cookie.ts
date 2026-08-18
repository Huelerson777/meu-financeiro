// Cookie leve só pra dar ao middleware (que roda no edge, sem acesso ao
// localStorage) um sinal de "este navegador tem uma sessão" e assim decidir
// pra onde mandar `/`, `/login` etc. sem esperar o client hidratar.
//
// Isso NÃO é o mecanismo de autenticação — não guarda o token, só um
// marcador. Quem autentica as chamadas de API continua sendo o JWT em
// `useAuthStore`, validado pelo backend a cada request; se esse token
// não existir ou o refresh falhar, o AuthGuard desloga de verdade
// (limpando esse cookie também). Ver `frontend/middleware.ts`.
const SESSION_COOKIE_NAME = 'ff_session';

// Mesmos números do refresh token no backend (ver REFRESH_EXPIRES_DAYS em
// backend/src/auth/auth.service.ts) — sem "lembrar de mim" o refresh já
// expira em 7 dias reais; manter o cookie mais generoso que isso só faz o
// dashboard "abrir e falhar" por mais tempo antes do logout de verdade.
const DEFAULT_MAX_AGE_DAYS = 7;
const REMEMBER_ME_MAX_AGE_DAYS = 28;

export function setSessionCookie(rememberMe = false) {
  if (typeof document === 'undefined') return;
  const days = rememberMe ? REMEMBER_ME_MAX_AGE_DAYS : DEFAULT_MAX_AGE_DAYS;
  const secure = typeof location !== 'undefined' && location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${SESSION_COOKIE_NAME}=1; Path=/; Max-Age=${days * 24 * 60 * 60}; SameSite=Lax${secure}`;
}

export function clearSessionCookie() {
  if (typeof document === 'undefined') return;
  document.cookie = `${SESSION_COOKIE_NAME}=; Path=/; Max-Age=0; SameSite=Lax`;
}
