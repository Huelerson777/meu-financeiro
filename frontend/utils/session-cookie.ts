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
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // teto generoso; quem expira de fato é o refresh token

export function setSessionCookie() {
  if (typeof document === 'undefined') return;
  const secure = typeof location !== 'undefined' && location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${SESSION_COOKIE_NAME}=1; Path=/; Max-Age=${MAX_AGE_SECONDS}; SameSite=Lax${secure}`;
}

export function clearSessionCookie() {
  if (typeof document === 'undefined') return;
  document.cookie = `${SESSION_COOKIE_NAME}=; Path=/; Max-Age=0; SameSite=Lax`;
}
