import { NextRequest, NextResponse } from 'next/server';

// Mesmo nome do cookie criado em utils/session-cookie.ts — mantido como
// string literal aqui (em vez de importado) porque middleware roda no
// Edge Runtime e esse arquivo não precisa de mais nada de lá.
//
// Isso NÃO é o mecanismo de autenticação real: é só um sinal de "este
// navegador tem uma sessão" pra decidir rotas no edge, sem esperar o
// client hidratar o Zustand. Quem autentica de fato as chamadas de API é
// o JWT validado pelo backend a cada request; o AuthGuard client-side
// continua sendo a checagem definitiva (e desloga/limpa esse cookie se o
// token ou o refresh forem inválidos).
const SESSION_COOKIE_NAME = 'ff_session';

const PUBLIC_PATHS = ['/login', '/register', '/forgot-password', '/reset-password'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = request.cookies.has(SESSION_COOKIE_NAME);

  if (pathname === '/') {
    return NextResponse.redirect(new URL(hasSession ? '/dashboard' : '/login', request.url));
  }

  const isPublicPath = PUBLIC_PATHS.some((p) => pathname.startsWith(p));

  if (!hasSession && !isPublicPath) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  if (hasSession && isPublicPath) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next();
}

export const config = {
  // Ignora assets do Next e arquivos estáticos comuns (caso um dia entrem
  // em frontend/public/) — evita que um <img> ou favicon vire redirect.
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'],
};
