'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut, User as UserIcon } from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';

export function UserMenu() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  const handleLogout = () => {
    logout();
    setOpen(false);
    router.replace('/login');
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Menu do usuário"
        className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/20 text-xs font-semibold text-primary hover:bg-primary/30 transition-theme"
      >
        {user?.name ? user.name.charAt(0).toUpperCase() : <UserIcon className="h-4 w-4" />}
      </button>

      {open && (
        <>
          {/* Fecha o menu ao clicar fora */}
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 w-48 rounded-md border border-border bg-card shadow-lg z-20 py-1">
            {user && (
              <div className="px-3 py-2 border-b border-border">
                <p className="text-sm font-medium text-foreground truncate">{user.name}</p>
                <p className="text-xs text-muted-foreground truncate">{user.email}</p>
              </div>
            )}
            <button
              onClick={handleLogout}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-danger hover:bg-muted transition-theme"
            >
              <LogOut className="h-4 w-4" />
              Sair
            </button>
          </div>
        </>
      )}
    </div>
  );
}
