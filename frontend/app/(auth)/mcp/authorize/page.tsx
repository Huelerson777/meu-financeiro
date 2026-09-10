'use client';

import { FormEvent, Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { authService } from '@/services/auth.service';
import { mcpOAuthService } from '@/services/mcp-oauth.service';
import { useAuthStore } from '@/stores/auth-store';

/**
 * Tela de consentimento do fluxo OAuth do MCP (ver backend/src/mcp/
 * mcp-oauth.service.ts#buildAuthorizeRedirect) — pra onde o backend
 * redireciona a partir de GET /mcp/oauth/authorize. Funciona logado ou
 * deslogado: sem sessão, pede login (form próprio, sem depender de
 * app/(auth)/login); com sessão, mostra o consentimento direto.
 */
function McpAuthorizeContent() {
  const searchParams = useSearchParams();
  const clientId = searchParams.get('client_id');
  const redirectUri = searchParams.get('redirect_uri');
  const codeChallenge = searchParams.get('code_challenge');
  const codeChallengeMethod = searchParams.get('code_challenge_method');
  const state = searchParams.get('state');
  const clientName = searchParams.get('client_name');

  const accessToken = useAuthStore((s) => s.accessToken);
  const hasHydrated = useAuthStore((s) => s.hasHydrated);
  const setTokens = useAuthStore((s) => s.setTokens);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const missingParams = !clientId || !redirectUri || !codeChallenge || !codeChallengeMethod;

  function redirectTo(params: Record<string, string>) {
    const url = new URL(redirectUri as string);
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

  if (missingParams) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-foreground">Link inválido</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Este link de autorização está incompleto ou inválido.</p>
        </CardContent>
      </Card>
    );
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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-foreground">Autorizar acesso</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <p className="text-sm text-muted-foreground">
          <strong className="text-foreground">{clientName || 'Este aplicativo'}</strong> quer acessar sua conta PouPay para
          consultar e lançar transações, cartões e investimentos em seu nome.
        </p>
        <div className="flex gap-3">
          <Button variant="outline" className="w-full" onClick={handleDeny} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button className="w-full" onClick={handleAuthorize} isLoading={isSubmitting}>
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
