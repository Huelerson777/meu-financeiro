'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import { api } from '@/services/api';
import { useIdleLogout } from '@/hooks/use-idle-logout';

/**
 * Protege as rotas do grupo (dashboard). Aguarda o Zustand terminar de
 * reidratar o localStorage antes de decidir se redireciona — evita o
 * "flash" de redirecionamento indevido para /login em um reload de página.
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const accessToken = useAuthStore((s) => s.accessToken);
  const hasHydrated = useAuthStore((s) => s.hasHydrated);
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);

  useEffect(() => {
    if (hasHydrated && !accessToken) {
      router.replace('/login');
    }
  }, [hasHydrated, accessToken, router]);

  useIdleLogout(hasHydrated && !!accessToken);

  // O login só grava os tokens (ver login/page.tsx) — o nome do usuário só
  // fica disponível depois dessa busca, seja logo após o login ou ao
  // recarregar uma sessão já existente.
  useEffect(() => {
    if (!hasHydrated || !accessToken || user) return;
    api.get('/users/me').then((res) => {
      const data = res.data?.data ?? res.data;
      if (data?.name) setUser(data);
    }).catch(() => {});
  }, [hasHydrated, accessToken, user, setUser]);

  if (!hasHydrated || !accessToken) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return <>{children}</>;
}
