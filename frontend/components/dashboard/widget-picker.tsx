'use client';

import { notifyAlert } from '@/utils/notify';
import { useEffect, useRef, useState } from 'react';
import { SlidersHorizontal, Check } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api';
import { useSettings } from '@/hooks/use-settings';

// A ordem desta lista é a ordem padrão do Início, pensada em três perguntas:
// 1) estou bem este mês? (hero + indicadores) 2) o que preciso fazer agora?
// 3) para onde foi o dinheiro? — e depois o panorama (contas, metas, histórico).
export const DASHBOARD_WIDGETS: { key: string; label: string }[] = [
  { key: 'aiQuickAdd', label: 'Lançamento por IA' },
  { key: 'income', label: 'Receitas' },
  { key: 'expense', label: 'Despesas' },
  { key: 'invested', label: 'Investido' },
  { key: 'leftovers', label: 'Disponível nas contas' },
  { key: 'paymentsStatus', label: 'Para fazer agora' },
  { key: 'categoryChart', label: 'Despesas por categoria' },
  { key: 'recentTransactions', label: 'Transações recentes' },
  { key: 'accountBalances', label: 'Saldo por conta' },
  { key: 'goalsSummary', label: 'Resumo de metas' },
  { key: 'yearlyChart', label: 'Evolução anual' },
  { key: 'netWorth', label: 'Patrimônio ao longo do tempo' },
  { key: 'balanceChart', label: 'Resultado do mês (detalhado)' },
];

const ALL_KEYS = DASHBOARD_WIDGETS.map((w) => w.key);
// Fora do padrão por repetir o que o topo já mostra (sobra do mês e
// receitas x despesas) — continua disponível em "Personalizar".
const OFF_BY_DEFAULT = ['balanceChart'];
const DEFAULT_KEYS = ALL_KEYS.filter((k) => !OFF_BY_DEFAULT.includes(k));
const LAYOUT_VERSION_KEY = 'poupay:dashboard-layout';
const LAYOUT_VERSION = '2';

// Widgets que já existiam antes do sistema de "novos widgets" — não contam como novidade.
const LEGACY_WIDGET_KEYS = [
  'aiQuickAdd', 'income', 'expense', 'invested', 'leftovers', 'paymentsStatus',
  'balanceChart', 'yearlyChart', 'categoryChart', 'accountBalances', 'goalsSummary',
];
const SEEN_WIDGETS_KEY = 'poupay:seen-widgets';

/**
 * Quantas colunas cada widget ocupa numa grade `grid-cols-2 lg:grid-cols-4`
 * (os indicadores ficam em pares no celular e numa faixa de quatro no desktop) — usado pelo Dashboard pra montar a grade arrastável
 * mantendo o mesmo layout visual de hoje (tiles pequenos, gráficos
 * grandes lado a lado, o resto largura total).
 */
export const WIDGET_SPANS: Record<string, string> = {
  aiQuickAdd: 'col-span-2 lg:col-span-4',
  income: 'col-span-1',
  expense: 'col-span-1',
  invested: 'col-span-1',
  leftovers: 'col-span-1',
  paymentsStatus: 'col-span-2 lg:col-span-4',
  balanceChart: 'col-span-2',
  yearlyChart: 'col-span-2',
  categoryChart: 'col-span-2',
  recentTransactions: 'col-span-2',
  accountBalances: 'col-span-2 lg:col-span-4',
  goalsSummary: 'col-span-2 lg:col-span-4',
  netWorth: 'col-span-2 lg:col-span-4',
};

export function useEnabledWidgets(): { isEnabled: (key: string) => boolean; loaded: boolean } {
  const { data, isLoading } = useSettings();
  const enabled = data?.dashboardWidgets ?? DEFAULT_KEYS;
  return { isEnabled: (key: string) => enabled.includes(key), loaded: !isLoading };
}

/**
 * A ordem dos itens em `dashboardWidgets` é também a ordem de exibição —
 * usado pelo Dashboard pra montar a grade arrastável e persistir uma nova
 * ordem depois de soltar um card.
 */
export function useDashboardWidgetOrder(): {
  order: string[];
  setOrder: (next: string[]) => void;
  loaded: boolean;
} {
  const { data, isLoading } = useSettings();
  const queryClient = useQueryClient();
  const order = data?.dashboardWidgets ?? DEFAULT_KEYS;

  const setOrder = (next: string[]) => {
    queryClient.setQueryData(['settings'], (prev: any) => ({ ...prev, dashboardWidgets: next }));
    api.patch('/settings', { dashboardWidgets: next }).catch(() => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
    });
  };

  // Widgets lançados depois que o usuário personalizou o dashboard entram uma única vez
  // (guardamos no navegador quais já foram "apresentados"; se ele ocultar depois, respeitamos).
  useEffect(() => {
    if (isLoading) return;
    const saved = data?.dashboardWidgets;

    // Reorganização do Início (uma vez): quem já tinha uma ordem salva no
    // layout antigo (com "Resultado do mês") passa pra ordem nova, mantendo só
    // os widgets que estavam ligados. Depois disso a ordem é do usuário.
    let layoutDone = false;
    try {
      layoutDone = localStorage.getItem(LAYOUT_VERSION_KEY) === LAYOUT_VERSION;
    } catch {
      /* sem localStorage: só não migra */
      layoutDone = true;
    }
    if (!layoutDone) {
      try {
        localStorage.setItem(LAYOUT_VERSION_KEY, LAYOUT_VERSION);
      } catch {
        /* ignora */
      }
      if (saved && saved.includes('balanceChart')) {
        setOrder(DEFAULT_KEYS.filter((k) => saved.includes(k) || !ALL_KEYS.includes(k)));
        try {
          localStorage.setItem(SEEN_WIDGETS_KEY, JSON.stringify(ALL_KEYS));
        } catch {
          /* ignora */
        }
        return;
      }
    }

    let seen: string[] = LEGACY_WIDGET_KEYS;
    try {
      const raw = localStorage.getItem(SEEN_WIDGETS_KEY);
      if (raw) seen = JSON.parse(raw);
    } catch {
      /* usa o padrão */
    }
    const fresh = DEFAULT_KEYS.filter((k) => !seen.includes(k));
    if (fresh.length === 0) return;
    if (saved) {
      let next = [...saved];
      fresh.forEach((k) => {
        if (next.includes(k)) return;
        const anchor = k === 'recentTransactions' ? next.indexOf('categoryChart') : -1;
        if (anchor >= 0) next.splice(anchor + 1, 0, k);
        else next.push(k);
      });
      setOrder(next);
    }
    try {
      localStorage.setItem(SEEN_WIDGETS_KEY, JSON.stringify(ALL_KEYS));
    } catch {
      /* ignora */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading]);

  return { order, setOrder, loaded: !isLoading };
}

export function WidgetPicker() {
  const { data } = useSettings();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const enabled = data?.dashboardWidgets ?? DEFAULT_KEYS;

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
      notifyAlert('Erro ao salvar preferência do dashboard.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        title="Personalizar tela principal"
        className="flex h-10 items-center gap-2 rounded-full bg-foreground/[0.05] px-3.5 text-sm font-medium text-muted-foreground transition-theme hover:bg-foreground/[0.08] hover:text-foreground"
      >
        <SlidersHorizontal className="h-4 w-4" />
        <span className="hidden sm:inline">Personalizar</span>
      </button>

      {open && (
        <div className="absolute right-0 z-40 mt-2 w-64 animate-fade-in rounded-2xl border border-border bg-card p-2 shadow-lift">
          <p className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
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
