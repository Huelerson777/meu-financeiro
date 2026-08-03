'use client';

import { Bell, Search } from 'lucide-react';
import { ThemeToggle } from './theme-toggle';
import { Input } from '@/components/ui/input';

export function Topbar() {
  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-border px-6">
      <div className="relative w-full max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Pesquisar transações, contas..." className="pl-9" />
      </div>

      <div className="flex items-center gap-2">
        <button
          aria-label="Notificações"
          className="relative flex h-10 w-10 items-center justify-center rounded-md text-muted-foreground transition-theme hover:bg-muted hover:text-foreground"
        >
          <Bell className="h-4 w-4" />
          <span className="absolute right-2.5 top-2.5 h-1.5 w-1.5 rounded-full bg-danger" />
        </button>
        <ThemeToggle />
        <div className="h-8 w-8 rounded-full bg-primary/20" />
      </div>
    </header>
  );
}
