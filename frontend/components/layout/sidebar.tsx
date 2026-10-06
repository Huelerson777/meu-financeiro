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
  X,
  PanelLeftClose,
  PanelLeftOpen,
  MessageSquareWarning,
} from 'lucide-react';
import { cn } from '@/utils/cn';
import { BrandMark } from './brand-mark';
import { useMobileNavStore } from '@/stores/mobile-nav-store';
import { useSidebarStore } from '@/stores/sidebar-store';
import { useAuthStore } from '@/stores/auth-store';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/accounts', label: 'Contas e Cartões', icon: Landmark },
  { href: '/transactions', label: 'Transações', icon: ArrowLeftRight },
  { href: '/recurring-bills', label: 'Contas Fixas', icon: Repeat },
  { href: '/investments', label: 'Investimentos', icon: TrendingUp },
  { href: '/goals', label: 'Metas', icon: Target },
  { href: '/reports', label: 'Fluxo de Caixa', icon: FileBarChart },
  { href: '/projection', label: 'Projeção', icon: LineChart },
  { href: '/settings', label: 'Configurações', icon: Settings },
];

const adminNavItem = { href: '/feedback', label: 'Feedbacks', icon: MessageSquareWarning };

function NavLinks({ onNavigate, collapsed }: { onNavigate?: () => void; collapsed?: boolean }) {
  const pathname = usePathname();
  const isAdmin = useAuthStore((s) => s.user?.role === 'ADMIN');
  const items = isAdmin ? [...navItems, adminNavItem] : navItems;
  return (
    <nav className="flex flex-1 flex-col gap-0.5 px-3 py-2">
      {items.map(({ href, label, icon: Icon }) => {
        const isActive = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            title={collapsed ? label : undefined}
            className={cn(
              'relative flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-muted-foreground transition-theme hover:bg-muted hover:text-foreground',
              collapsed && 'justify-center px-0',
              isActive && 'bg-primary text-primary-foreground shadow-[0_6px_14px_-6px_hsl(var(--primary)/0.6)] hover:bg-primary hover:text-primary-foreground',
            )}
          >
            <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={1.75} />
            {!collapsed && label}
          </Link>
        );
      })}
    </nav>
  );
}

function Logo({ collapsed }: { collapsed?: boolean }) {
  return (
    <div className={cn('flex h-16 items-center gap-2 px-6', collapsed && 'justify-center px-0')}>
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
          'hidden shrink-0 border-r border-border bg-card lg:flex lg:flex-col transition-[width] duration-150',
          'lg:sticky lg:top-0 lg:h-screen',
          collapsed ? 'w-16' : 'w-64',
        )}
      >
        <Logo collapsed={collapsed} />
        <div className="flex-1 overflow-y-auto">
          <NavLinks collapsed={collapsed} />
        </div>
        <div className="border-t border-border p-3">
          <button
            onClick={toggleSidebar}
            title={collapsed ? 'Expandir menu lateral' : 'Recolher menu lateral'}
            aria-label={collapsed ? 'Expandir menu lateral' : 'Recolher menu lateral'}
            className={cn(
              'flex h-10 w-full items-center gap-3 rounded-md px-3 text-sm font-medium text-muted-foreground transition-theme hover:bg-muted hover:text-foreground',
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
          <aside className="absolute left-0 top-0 h-full w-72 max-w-[85vw] animate-fade-in flex flex-col bg-card border-r border-border shadow-xl">
            <div className="flex items-center justify-between px-4">
              <Logo />
              <button
                onClick={close}
                aria-label="Fechar menu"
                className="p-2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <NavLinks onNavigate={close} />
          </aside>
        </div>
      )}
    </>
  );
}