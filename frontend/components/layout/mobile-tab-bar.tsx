'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, ArrowLeftRight, Landmark, Target, Menu } from 'lucide-react';
import { cn } from '@/utils/cn';
import { useMobileNavStore } from '@/stores/mobile-nav-store';

const tabs = [
  { href: '/dashboard', label: 'Início', icon: LayoutDashboard },
  { href: '/transactions', label: 'Transações', icon: ArrowLeftRight },
  { href: '/accounts', label: 'Contas', icon: Landmark },
  { href: '/goals', label: 'Metas', icon: Target },
];

/** Navegação inferior do celular — as 4 telas mais usadas + "Mais" abrindo o menu completo. */
export function MobileTabBar() {
  const pathname = usePathname();
  const open = useMobileNavStore((s) => s.toggle);

  const item = 'flex flex-1 flex-col items-center justify-center gap-1 py-2 text-[11px] font-semibold transition-theme active:scale-95';

  return (
    <nav
      aria-label="Navegação principal"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border/60 bg-card/90 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
    >
      <div className="mx-auto flex max-w-xl">
        {tabs.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={cn(item, active ? 'text-primary' : 'text-muted-foreground')}
            >
              <span className={cn('flex h-7 w-12 items-center justify-center rounded-full transition-theme', active && 'bg-primary/10')}>
                <Icon className="h-5 w-5" strokeWidth={active ? 2.1 : 1.75} />
              </span>
              {label}
            </Link>
          );
        })}
        <button type="button" onClick={open} className={cn(item, 'text-muted-foreground')}>
          <span className="flex h-7 w-12 items-center justify-center">
            <Menu className="h-5 w-5" strokeWidth={1.75} />
          </span>
          Mais
        </button>
      </div>
    </nav>
  );
}
