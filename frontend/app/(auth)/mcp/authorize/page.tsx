'use client';

import { FormEvent, Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { authService } from '@/services/auth.service';
import { McpClientInfo, mcpOAuthService } from '@/services/mcp-oauth.service';
import { useAuthStore } from '@/stores/auth-store';

const LOOPBACK_HOSTS = ['localhost', '127.0.0.1', '[::1]'];

/**
 * Mesma regra do backend (isAllowedRedirectUri em mcp-oauth.service.ts): só
 * https, ou http em loopback. A redirect_uri chega pela URL desta página —
 * um link malicioso poderia trazer `javascript:...`, que executaria script
 * aqui dentro ao redirecionar. Com isso o link nem chega a mostrar o login.
 */
function isSafeRedirectUri(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.protocol === 'https:') return true;
    return url.protocol === 'http:' && LOOPBACK_HOSTS.includes(url.hostname);
  } catch {
    return false;
  }
}

function InvalidLink({ message }: { message: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-foreground">Link inválido</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">{message}</p>
      </CardContent>
    </Card>
  );
}

/**
 * Tela de consentimento do fluxo OAuth do MCP (ver backend/src/mcp/
 * mcp-oauth.service.ts#buildAuthorizeRedirect) — pra onde o backend
 * redireciona a partir de GET /mcp/oauth/authorize. Funciona logado ou
 * deslogado: sem sessão, pede login (form próprio, sem depender de
 * app/(auth)/login); com sessão, mostra o consentimento direto.
 *
 * Nada do que vem na URL é tratado como confiável: o nome do aplicativo e o
 * destino exibidos vêm do servidor (mcpOAuthService.clientInfo), e os botões
 * só redirecionam depois dessa conferência — inclusive o "Cancelar".
 */
function McpAuthorizeContent() {
  const searchParams = useSearchParams();
  const clientId = searchParams.get('client_id');
  const redirectUri = searchParams.get('redirect_uri');
  const codeChallenge = searchParams.get('code_challenge');
  const codeChallengeMethod = searchParams.get('code_challenge_method');
  const state = searchParams.get('state');

  const accessToken = useAuthStore((s) => s.accessToken);
  const hasHydrated = useAuthStore((s) => s.hasHydrated);
  const setTokens = useAuthStore((s) => s.setTokens);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [client, setClient] = useState<McpClientInfo | null>(null);
  const [clientRejected, setClientRejected] = useState(false);

  const missingParams = !clientId || !redirectUri || !codeChallenge || !codeChallengeMethod;
  const unsafeRedirect = !!redirectUri && !isSafeRedirectUri(redirectUri);

  useEffect(() => {
    if (!accessToken || !clientId || !redirectUri || unsafeRedirect) return;
    let cancelled = false;
    setClient(null);
    setClientRejected(false);
    mcpOAuthService
      .clientInfo(clientId, redirectUri)
      .then((info) => {
        if (!cancelled) setClient(info);
      })
      .catch(() => {
        if (!cancelled) setClientRejected(true);
      });
    return () => {
      cancelled = true;
    };
  }, [accessToken, clientId, redirectUri, unsafeRedirect]);

  function redirectTo(params: Record<string, string>) {
    // Só redireciona pra um destino que o servidor confirmou ser deste aplicativo.
    if (!client || !redirectUri) return;
    const url = new URL(redirectUri);
    Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
    if (state) url.searchParams.set('state', state);
    window.location.href = url.toString();
  }

  async function handleLogin(event: FormEvent) {
    event.preventDefault();
    setIsSubmitting(true);
    try {
      const { accessToken: token, refreshToken } = await authService.login(email, password);
      setTokens(token, refreshToken);
    } catch (error: any) {
      toast.error(error?.response?.data?.message ?? 'Não foi possível entrar. Verifique suas credenciais.');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleAuthorize() {
    setIsSubmitting(true);
    try {
      const { code } = await mcpOAuthService.consent({
        clientId: clientId as string,
        redirectUri: redirectUri as string,
        codeChallenge: codeChallenge as string,
        codeChallengeMethod: codeChallengeMethod as string,
      });
      redirectTo({ code });
    } catch (error: any) {
      toast.error(error?.response?.data?.message ?? 'Não foi possível autorizar o acesso.');
      setIsSubmitting(false);
    }
  }

  function handleDeny() {
    redirectTo({ error: 'access_denied' });
  }

  if (missingParams || unsafeRedirect) {
    return <InvalidLink message="Este link de autorização está incompleto ou inválido." />;
  }

  if (!hasHydrated) return null;

  if (!accessToken) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-foreground">Entre para autorizar o acesso</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                autoComplete="username"
                placeholder="voce@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <Button type="submit" isLoading={isSubmitting} className="mt-2 w-full">
              Entrar
            </Button>
          </form>
        </CardContent>
      </Card>
    );
  }

  if (clientRejected) {
    return (
      <InvalidLink message="Não foi possível confirmar o aplicativo que pediu este acesso. Volte ao aplicativo e inicie a conexão de novo." />
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-foreground">Autorizar acesso</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {client ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">
              <strong className="text-foreground">{client.clientName || 'Este aplicativo'}</strong> quer acessar sua conta
              PouPay para consultar e lançar transações, cartões e investimentos em seu nome.
            </p>
            <p className="text-sm text-muted-foreground">
              Depois de responder, você volta para{' '}
              <strong className="break-all text-foreground">{client.redirectHost}</strong>. Só autorize se foi você quem
              iniciou esta conexão.
            </p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground" aria-live="polite">
            Conferindo o pedido de acesso…
          </p>
        )}
        <div className="flex gap-3">
          <Button variant="outline" className="w-full" onClick={handleDeny} disabled={!client || isSubmitting}>
            Cancelar
          </Button>
          <Button className="w-full" onClick={handleAuthorize} isLoading={isSubmitting} disabled={!client}>
            Autorizar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function McpAuthorizePage() {
  return (
    <Suspense fallback={null}>
      <McpAuthorizeContent />
    </Suspense>
  );
}
