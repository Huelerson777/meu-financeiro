'use client';

import { useEffect, useRef, useState } from 'react';
import { EyeOff, Check } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api';
import { useSettings } from '@/hooks/use-settings';
import { Account } from '@/types';

/**
 * IDs de contas ocultadas do gráfico "Saldo por Conta" do Dashboard — separado
 * do filtro `dashboardWidgets` (que liga/desliga o card inteiro) porque aqui
 * o usuário quer manter o card mas esconder só uma conta específica (ex: a
 * conta de investimentos que não faz sentido comparar ao lado das outras).
 */
export function useHiddenAccountIds(): {
  hiddenIds: string[];
  setHiddenIds: (next: string[]) => void;
} {
  const { data } = useSettings();
  const queryClient = useQueryClient();
  const hiddenIds = data?.dashboardHiddenAccountIds ?? [];

  const setHiddenIds = (next: string[]) => {
    queryClient.setQueryData(['settings'], (prev: any) => ({ ...prev, dashboardHiddenAccountIds: next }));
    api.patch('/settings', { dashboardHiddenAccountIds: next }).catch(() => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
    });
  };

  return { hiddenIds, setHiddenIds };
}

export function AccountVisibilityPicker({ accounts }: { accounts: Account[] }) {
  const { hiddenIds, setHiddenIds } = useHiddenAccountIds();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (accounts.length === 0) return null;

  const toggle = (id: string) => {
    const next = hiddenIds.includes(id) ? hiddenIds.filter((h) => h !== id) : [...hiddenIds, id];
    setHiddenIds(next);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        title="Escolher contas exibidas neste gráfico"
        className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition"
      >
        <EyeOff className="h-4 w-4" />
      </button>

      {open && (
        <div className="absolute right-0 z-40 mt-2 w-56 rounded-lg border border-border bg-card p-2 shadow-lg">
          <p className="px-2 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Contas exibidas
          </p>
          <div className="flex max-h-64 flex-col overflow-y-auto">
            {accounts.map((acc) => {
              const isOn = !hiddenIds.includes(acc.id);
              return (
                <button
                  key={acc.id}
                  onClick={() => toggle(acc.id)}
                  className="flex items-center justify-between gap-2 rounded-md px-2 py-2 text-sm hover:bg-muted transition"
                >
                  <span className="truncate">{acc.name}</span>
                  <span
                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                      isOn ? 'bg-primary border-primary text-primary-foreground' : 'border-border'
                    }`}
                  >
                    {isOn && <Check className="h-3 w-3" />}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
