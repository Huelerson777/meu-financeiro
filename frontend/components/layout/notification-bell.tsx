'use client';

import { useEffect, useRef, useState } from 'react';
import { Bell, CreditCard, Receipt, CheckCircle2, Target, AlertTriangle, Info } from 'lucide-react';
import { useNotifications, Notification } from '@/hooks/use-notifications';

const ICONS: Record<Notification['type'], typeof Bell> = {
  CARD_DUE: CreditCard,
  CARD_INVOICE_CLOSED: CheckCircle2,
  BILL_DUE: Receipt,
  GOAL_PROGRESS: Target,
  BUDGET_EXCEEDED: AlertTriangle,
  SYSTEM: Info,
};

function timeAgo(dateStr: string) {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return 'agora';
  if (minutes < 60) return `${minutes}min atrás`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h atrás`;
  const days = Math.floor(hours / 24);
  return `${days}d atrás`;
}

export function NotificationBell() {
  const { notifications, unreadCount, isLoading, markRead, markAllRead } = useNotifications();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Notificações"
        className="relative flex h-10 w-10 items-center justify-center rounded-md text-muted-foreground transition-theme hover:bg-muted hover:text-foreground"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-40 mt-2 w-80 max-h-96 overflow-y-auto rounded-lg border border-border bg-card shadow-lg">
          <div className="flex items-center justify-between px-3 py-2.5 border-b border-border">
            <p className="text-sm font-semibold">Notificações</p>
            {unreadCount > 0 && (
              <button onClick={() => markAllRead()} className="text-xs text-primary hover:underline">
                Marcar todas como lidas
              </button>
            )}
          </div>

          {isLoading ? (
            <p className="p-4 text-sm text-muted-foreground text-center">Carregando...</p>
          ) : notifications.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground text-center">
              Nenhuma notificação por enquanto.
            </p>
          ) : (
            <div className="flex flex-col divide-y divide-border">
              {notifications.map((n) => {
                const Icon = ICONS[n.type] ?? Info;
                return (
                  <button
                    key={n.id}
                    onClick={() => !n.read && markRead(n.id)}
                    className={`flex items-start gap-3 px-3 py-3 text-left text-sm transition hover:bg-muted ${
                      n.read ? '' : 'bg-primary/5'
                    }`}
                  >
                    <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${n.read ? 'text-muted-foreground' : 'text-primary'}`} />
                    <div className="min-w-0 flex-1">
                      <p className={`truncate ${n.read ? 'text-muted-foreground' : 'font-medium'}`}>{n.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{n.message}</p>
                      <p className="text-[11px] text-muted-foreground mt-1">{timeAgo(n.createdAt)}</p>
                    </div>
                    {!n.read && <span className="mt-1.5 h-2 w-2 rounded-full bg-primary shrink-0" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
