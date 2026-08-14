'use client';

import { useEffect, useRef, useState } from 'react';
import { SlidersHorizontal, Check } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api';
import { useSettings } from '@/hooks/use-settings';

export const DASHBOARD_WIDGETS: { key: string; label: string }[] = [
  { key: 'income', label: 'Receitas' },
  { key: 'expense', label: 'Despesas' },
  { key: 'invested', label: 'Investido' },
  { key: 'leftovers', label: 'Sobras' },
  { key: 'paymentsStatus', label: 'Pago x Em Aberto' },
  { key: 'balanceChart', label: 'Balanço do Mês' },
  { key: 'yearlyChart', label: 'Evolução Anual' },
  { key: 'categoryChart', label: 'Despesas por Categoria' },
  { key: 'netWorthChart', label: 'Patrimônio' },
  { key: 'goalsSummary', label: 'Resumo de Metas' },
];

const ALL_KEYS = DASHBOARD_WIDGETS.map((w) => w.key);

export function useEnabledWidgets(): { isEnabled: (key: string) => boolean; loaded: boolean } {
  const { data, isLoading } = useSettings();
  const enabled = data?.dashboardWidgets ?? ALL_KEYS;
  return { isEnabled: (key: string) => enabled.includes(key), loaded: !isLoading };
}

export function WidgetPicker() {
  const { data } = useSettings();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const enabled = data?.dashboardWidgets ?? ALL_KEYS;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggle = async (key: string) => {
    const next = enabled.includes(key) ? enabled.filter((k) => k !== key) : [...enabled, key];
    setSaving(true);
    // Atualiza otimisticamente o cache do react-query
    queryClient.setQueryData(['settings'], (prev: any) => ({ ...prev, dashboardWidgets: next }));
    try {
      await api.patch('/settings', { dashboardWidgets: next });
    } catch {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      alert('Erro ao salvar preferência do dashboard.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        title="Personalizar tela principal"
        className="flex h-10 items-center gap-2 rounded-md border border-border bg-background px-3 text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition"
      >
        <SlidersHorizontal className="h-4 w-4" />
        <span className="hidden sm:inline">Personalizar</span>
      </button>

      {open && (
        <div className="absolute right-0 z-40 mt-2 w-64 rounded-lg border border-border bg-card p-2 shadow-lg">
          <p className="px-2 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            O que aparece aqui
          </p>
          <div className="flex flex-col">
            {DASHBOARD_WIDGETS.map((w) => {
              const isOn = enabled.includes(w.key);
              return (
                <button
                  key={w.key}
                  onClick={() => toggle(w.key)}
                  disabled={saving}
                  className="flex items-center justify-between gap-2 rounded-md px-2 py-2 text-sm hover:bg-muted transition disabled:opacity-50"
                >
                  <span>{w.label}</span>
                  <span
                    className={`flex h-4 w-4 items-center justify-center rounded border ${
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
