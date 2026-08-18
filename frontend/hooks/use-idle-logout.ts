'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useAuthStore } from '@/stores/auth-store';
import { useLastActivityStore } from '@/stores/last-activity-store';

const IDLE_LIMIT_MS = 15 * 60 * 1000;
// Não precisa persistir a cada mousemove — só de tempos em tempos, o
// suficiente pra não perder mais que isso de precisão na checagem feita
// ao reabrir o app.
const PERSIST_THROTTLE_MS = 10 * 1000;
const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'wheel'] as const;

/**
 * Desloga automaticamente após 15 minutos sem interação — vale tanto pra
 * aba ficar aberta e ociosa quanto pro app ficar fechado esse tempo todo:
 * a última atividade é persistida (`useLastActivityStore`) e, ao reabrir,
 * é isso que é checado primeiro. Sem essa checagem na reabertura, bastaria
 * fechar a aba pra "escapar" do logoff por inatividade, já que o timer em
 * memória (setTimeout) não sobrevive ao fechamento.
 */
export function useIdleLogout(enabled: boolean) {
  const router = useRouter();
  const logout = useAuthStore((s) => s.logout);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastPersistRef = useRef(0);

  useEffect(() => {
    if (!enabled) return;

    const handleIdle = () => {
      logout();
      toast.info('Sessão encerrada por inatividade.');
      router.replace('/login');
    };

    const lastActivityAt = useLastActivityStore.getState().lastActivityAt;
    if (lastActivityAt && Date.now() - lastActivityAt > IDLE_LIMIT_MS) {
      handleIdle();
      return;
    }

    const touch = () => {
      const now = Date.now();
      if (now - lastPersistRef.current > PERSIST_THROTTLE_MS) {
        lastPersistRef.current = now;
        useLastActivityStore.getState().touch();
      }
    };

    const resetTimer = () => {
      touch();
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(handleIdle, IDLE_LIMIT_MS);
    };

    resetTimer();
    ACTIVITY_EVENTS.forEach((evt) => window.addEventListener(evt, resetTimer, { passive: true }));

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      ACTIVITY_EVENTS.forEach((evt) => window.removeEventListener(evt, resetTimer));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);
}
