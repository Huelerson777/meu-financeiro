import { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api';
import { useSettings, type UserSettings } from '@/hooks/use-settings';

export type PlanningKey = 'monthlySpendingLimit' | 'projectionExpectedIncome' | 'projectionFlexibleSpend';

function readLocal(storageKey: string): number | null {
  try {
    const raw = localStorage.getItem(storageKey);
    const n = raw == null ? NaN : Number(raw);
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

function writeLocal(storageKey: string, value: number | null) {
  try {
    if (value == null) localStorage.removeItem(storageKey);
    else localStorage.setItem(storageKey, String(value));
  } catch {
    /* sem storage: só o servidor guarda */
  }
}

/**
 * Valor de planejamento (limite do mês, receita esperada...) guardado no servidor.
 * O navegador funciona como cópia de segurança: se o servidor ainda não conhece o campo
 * ou a gravação falhar, o valor continua valendo localmente; e um valor antigo que só existia
 * no navegador é enviado ao servidor uma única vez.
 */
export function usePlanningValue(key: PlanningKey, storageKey: string) {
  const { data: settings, isLoading } = useSettings();
  const queryClient = useQueryClient();
  const [local, setLocal] = useState<number | null>(null);
  const migrated = useRef(false);

  useEffect(() => {
    setLocal(readLocal(storageKey));
  }, [storageKey]);

  const serverSupportsField = !!settings && key in settings;
  const remoteRaw = settings ? (settings as UserSettings)[key] : undefined;
  const remote = remoteRaw != null && Number.isFinite(Number(remoteRaw)) && Number(remoteRaw) > 0 ? Number(remoteRaw) : null;
  const value = remote ?? local;

  const save = useCallback(
    (next: number | null) => {
      setLocal(next);
      writeLocal(storageKey, next);
      queryClient.setQueryData(['settings'], (prev: any) => (prev ? { ...prev, [key]: next } : prev));
      api.patch('/settings', { [key]: next }).catch(() => {
        /* servidor sem suporte ainda: segue com a cópia local */
      });
    },
    [key, queryClient, storageKey],
  );

  // migração única: valor só local -> servidor
  useEffect(() => {
    if (migrated.current || isLoading || !serverSupportsField) return;
    migrated.current = true;
    if (remote == null && local != null) {
      api.patch('/settings', { [key]: local }).then(() => {
        queryClient.setQueryData(['settings'], (prev: any) => (prev ? { ...prev, [key]: local } : prev));
      }).catch(() => {});
    }
  }, [isLoading, serverSupportsField, remote, local, key, queryClient]);

  return { value, save, isLoading };
}
