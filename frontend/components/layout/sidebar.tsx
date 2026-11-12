'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Landmark,
  ArrowLeftRight,
  TrendingUp,
  Target,
  Settings,
  FileBarChart,
  Repeat,
  LineChart,
  PiggyBank,
  ScrollText,
  X,
  PanelLeftClose,
  PanelLeftOpen,
  MessageSquareWarning,
  Link2,
  CreditCard,
} from 'lucide-react';
import { cn } from '@/utils/cn';
import { BrandMark } from './brand-mark';
import { useMobileNavStore } from '@/stores/mobile-nav-store';
import { useSidebarStore } from '@/stores/sidebar-store';
import { useAuthStore } from '@/stores/auth-store';

// Agrupado por intenção de uso em vez de uma lista corrida de 12 itens:
// o que se olha todo dia, o que se planeja, o que se analisa e a conta.
const navGroups = [
  {
    label: null,
    items: [
      { href: '/dashboard', label: 'Início', icon: LayoutDashboard },
      { href: '/transactions', label: 'Transações', icon: ArrowLeftRight },
      { href: '/accounts', label: 'Contas', icon: Landmark },
      { href: '/cards', label: 'Cartões', icon: CreditCard },
      { href: '/recurring-bills', label: 'Recorrentes', icon: Repeat },
    ],
  },
  {
    label: 'Planejar',
    items: [
      { href: '/budgets', label: 'Orçamento', icon: PiggyBank },
      { href: '/goals', label: 'Metas', icon: Target },
      { href: '/investments', label: 'Investimentos', icon: TrendingUp },
      { href: '/projection', label: 'Projeção', icon: LineChart },
    ],
  },
  {
    label: 'Analisar',
    items: [
      { href: '/reports', label: 'Fluxo de Caixa', icon: FileBarChart },
      { href: '/summary', label: 'Resumo do mês', icon: ScrollText },
    ],
  },
  {
    label: 'Conta',
    items: [
      { href: '/open-finance', label: 'Open Finance', icon: Link2 },
      { href: '/settings', label: 'Configurações', icon: Settings },
    ],
  },
];

const adminNavItem = { href: '/feedback', label: 'Feedbacks', icon: MessageSquareWarning };

function NavLinks({ onNavigate, collapsed }: { onNavigate?: () => void; collapsed?: boolean }) {
  const pathname = usePathname();
  const isAdmin = useAuthStore((s) => s.user?.role === 'ADMIN');
  const groups = isAdmin
    ? navGroups.map((g, i) => (i === navGroups.length - 1 ? { ...g, items: [...g.items, adminNavItem] } : g))
    : navGroups;

  return (
    <nav className={cn('flex flex-1 flex-col gap-5 px-3 py-3', collapsed && 'gap-3')}>
      {groups.map((group, gi) => (
        <div key={gi} className="flex flex-col gap-0.5">
          {group.label &&
            (collapsed ? (
              <span className="mx-auto mb-2 h-px w-6 bg-border" aria-hidden />
            ) : (
              <p className="mb-1 px-3 text-[11px] font-semibold tracking-wide text-muted-foreground/70">{group.label}</p>
            ))}
          {group.items.map(({ href, label, icon: Icon }) => {
            const isActive = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                onClick={onNavigate}
                title={collapsed ? label : undefined}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'relative flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium text-muted-foreground transition-theme hover:bg-foreground/[0.04] hover:text-foreground',
                  collapsed && 'justify-center px-0',
                  isActive && 'bg-primary/10 font-semibold text-primary hover:bg-primary/10 hover:text-primary',
                )}
              >
                {/* Marcador do item atual: uma barra fina na borda, em vez de pintar o item inteiro */}
                <span
                  aria-hidden
                  className={cn(
                    'absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-primary transition-transform duration-200',
                    isActive ? 'scale-y-100' : 'scale-y-0',
                  )}
                />
                <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={isActive ? 2 : 1.75} />
                {!collapsed && label}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

function Logo({ collapsed }: { collapsed?: boolean }) {
  return (
    <div className={cn('flex h-16 items-center gap-2 px-5', collapsed && 'justify-center px-0')}>
      <BrandMark />
      {!collapsed && <span className="font-display text-xl font-bold tracking-tight">PouPay</span>}
    </div>
  );
}

export function Sidebar() {
  const isOpen = useMobileNavStore((s) => s.isOpen);
  const close = useMobileNavStore((s) => s.close);
  const collapsed = useSidebarStore((s) => s.collapsed);
  const toggleSidebar = useSidebarStore((s) => s.toggle);

  return (
    <>
      {/* Versão fixa para telas grandes (desktop) — o botão no rodapé do próprio
          menu alterna entre expandida e uma "trilha" só com os ícones (nomes ficam ocultos) */}
      <aside
        className={cn(
          'hidden shrink-0 border-r border-border/60 bg-background lg:flex lg:flex-col transition-[width] duration-200 print:hidden',
          'lg:sticky lg:top-0 lg:h-screen',
          collapsed ? 'w-16' : 'w-60',
        )}
      >
        <Logo collapsed={collapsed} />
        <div className="flex-1 overflow-y-auto">
          <NavLinks collapsed={collapsed} />
        </div>
        <div className="p-3">
          <button
            onClick={toggleSidebar}
            title={collapsed ? 'Expandir menu lateral' : 'Recolher menu lateral'}
            aria-label={collapsed ? 'Expandir menu lateral' : 'Recolher menu lateral'}
            className={cn(
              'flex h-10 w-full items-center gap-3 rounded-lg px-3 text-sm font-medium text-muted-foreground transition-theme hover:bg-foreground/[0.04] hover:text-foreground',
              collapsed && 'justify-center px-0',
            )}
          >
            {collapsed ? <PanelLeftOpen className="h-4 w-4 shrink-0" /> : <PanelLeftClose className="h-4 w-4 shrink-0" />}
            {!collapsed && 'Recolher menu'}
          </button>
        </div>
      </aside>

      {/* Versão "gaveta" para celular/tablet — só existe quando aberta */}
      {isOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          {/* Fundo escurecido — clicar fecha o menu */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" onClick={close} />

          {/* Painel deslizante */}
          <aside className="absolute left-0 top-0 flex h-full w-72 max-w-[85vw] animate-fade-in flex-col border-r border-border/60 bg-background shadow-xl">
            <div className="flex items-center justify-between pr-3">
              <Logo />
              <button
                onClick={close}
                aria-label="Fechar menu"
                className="flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground hover:bg-foreground/[0.05] hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto pb-[env(safe-area-inset-bottom)]">
              <NavLinks onNavigate={close} />
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
