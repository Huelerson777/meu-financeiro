'use client';

import { Menu } from 'lucide-react';
import { ThemeToggle } from './theme-toggle';
import { UserMenu } from './user-menu';
import { SearchBox } from './search-box';
import { NotificationBell } from './notification-bell';
import { useMobileNavStore } from '@/stores/mobile-nav-store';

export function Topbar() {
  const toggleMobileNav = useMobileNavStore((s) => s.toggle);

  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-border px-4 sm:px-6 gap-3">
      <button
        onClick={toggleMobileNav}
        aria-label="Abrir menu"
        className="lg:hidden flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <Menu className="h-5 w-5" />
      </button>

      <SearchBox />

      <div className="flex items-center gap-2">
        <NotificationBell />
        <ThemeToggle />
        <UserMenu />
      </div>
    </header>
  );
}
