'use client';

import { Menu, Eye, EyeOff, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { ThemeToggle } from './theme-toggle';
import { UserMenu } from './user-menu';
import { SearchBox } from './search-box';
import { NotificationBell } from './notification-bell';
import { useMobileNavStore } from '@/stores/mobile-nav-store';
import { useValuesVisibilityStore } from '@/stores/values-visibility-store';
import { useSidebarStore } from '@/stores/sidebar-store';

export function Topbar() {
  const toggleMobileNav = useMobileNavStore((s) => s.toggle);
  const hidden = useValuesVisibilityStore((s) => s.hidden);
  const toggleHidden = useValuesVisibilityStore((s) => s.toggle);
  const sidebarCollapsed = useSidebarStore((s) => s.collapsed);
  const toggleSidebar = useSidebarStore((s) => s.toggle);

  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-border px-4 sm:px-6 gap-3">
      <button
        onClick={toggleMobileNav}
        aria-label="Abrir menu"
        className="lg:hidden flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <Menu className="h-5 w-5" />
      </button>

      <button
        onClick={toggleSidebar}
        title={sidebarCollapsed ? 'Expandir menu lateral' : 'Recolher menu lateral'}
        aria-label={sidebarCollapsed ? 'Expandir menu lateral' : 'Recolher menu lateral'}
        className="hidden lg:flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-theme"
      >
        {sidebarCollapsed ? <PanelLeftOpen className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
      </button>

      <SearchBox />

      <div className="flex items-center gap-2">
        <button
          onClick={toggleHidden}
          title={hidden ? 'Mostrar valores' : 'Ocultar valores'}
          aria-label={hidden ? 'Mostrar valores' : 'Ocultar valores'}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-theme"
        >
          {hidden ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
        </button>
        <NotificationBell />
        <ThemeToggle />
        <UserMenu />
      </div>
    </header>
  );
}
