'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Landmark,
  ArrowLeftRight,
  CreditCard,
  TrendingUp,
  Target,
  Settings,
  Wallet,
  FileBarChart,
  X,
} from 'lucide-react';
import { cn } from '@/utils/cn';
import { useMobileNavStore } from '@/stores/mobile-nav-store';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/accounts', label: 'Contas', icon: Landmark },
  { href: '/transactions', label: 'Transações', icon: ArrowLeftRight },
  { href: '/cards', label: 'Cartões', icon: CreditCard },
  { href: '/investments', label: 'Investimentos', icon: TrendingUp },
  { href: '/goals', label: 'Metas', icon: Target },
  { href: '/reports', label: 'Relatórios', icon: FileBarChart },
  { href: '/settings', label: 'Configurações', icon: Settings },
];

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-1 flex-col gap-0.5 px-3 py-2">
      {navItems.map(({ href, label, icon: Icon }) => {
        const isActive = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            className={cn(
              'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-theme hover:bg-muted hover:text-foreground',
              isActive && 'bg-primary/10 text-primary hover:bg-primary/10 hover:text-primary',
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

function Logo() {
  return (
    <div className="flex h-16 items-center gap-2 px-6">
      <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary">
        <Wallet className="h-4 w-4 text-primary-foreground" />
      </div>
      <span className="text-base font-semibold tracking-tight">FinanceFlow</span>
    </div>
  );
}

export function Sidebar() {
  const isOpen = useMobileNavStore((s) => s.isOpen);
  const close = useMobileNavStore((s) => s.close);

  return (
    <>
      {/* Versão fixa para telas grandes (desktop) */}
      <aside className="hidden w-64 shrink-0 border-r border-border bg-card lg:flex lg:flex-col">
        <Logo />
        <NavLinks />
      </aside>

      {/* Versão "gaveta" para celular/tablet — só existe quando aberta */}
      {isOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          {/* Fundo escurecido — clicar fecha o menu */}
          <div className="absolute inset-0 bg-black/60" onClick={close} />

          {/* Painel deslizante */}
          <aside className="absolute left-0 top-0 h-full w-64 flex flex-col bg-card border-r border-border shadow-xl">
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