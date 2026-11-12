'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, ArrowLeftRight, Landmark, CreditCard, Plus } from 'lucide-react';
import { cn } from '@/utils/cn';

const leftTabs = [
  { href: '/dashboard', label: 'Início', icon: LayoutDashboard },
  { href: '/transactions', label: 'Transações', icon: ArrowLeftRight },
];
const rightTabs = [
  { href: '/accounts', label: 'Contas', icon: Landmark },
  { href: '/cards', label: 'Cartões', icon: CreditCard },
];

const item =
  'flex flex-1 flex-col items-center justify-center gap-0.5 rounded-2xl py-1.5 text-[10.5px] font-semibold transition-theme active:scale-95';

/**
 * Navegação do celular como uma "doca" flutuante: as telas do dia a dia
 * (Início, Transações, Contas, Cartões) e o lançamento rápido no centro. O
 * menu completo fica no botão ☰ do topo.
 */
export function MobileTabBar() {
  const pathname = usePathname();

  const renderTab = ({ href, label, icon: Icon }: (typeof leftTabs)[number]) => {
    const active = pathname === href;
    return (
      <Link
        key={href}
        href={href}
        aria-current={active ? 'page' : undefined}
        className={cn(item, active ? 'text-primary' : 'text-muted-foreground')}
      >
        <Icon className="h-5 w-5" strokeWidth={active ? 2.1 : 1.75} />
        {label}
      </Link>
    );
  };

  return (
    <nav
      aria-label="Navegação principal"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:hidden print:hidden"
    >
      <div className="pointer-events-auto mx-auto flex max-w-md items-center gap-1 rounded-[1.4rem] border border-border/70 bg-card/95 px-2 py-1.5 shadow-lift backdrop-blur-md">
        {leftTabs.map(renderTab)}
        <Link
          href="/transactions?new=1"
          aria-label="Novo lançamento"
          className="mx-1 flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-[0_8px_18px_-8px_hsl(var(--primary)/0.7)] transition-theme active:scale-95"
        >
          <Plus className="h-6 w-6" strokeWidth={2.2} />
        </Link>
        {rightTabs.map(renderTab)}
      </div>
    </nav>
  );
}
