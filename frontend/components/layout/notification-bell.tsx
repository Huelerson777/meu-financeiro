'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
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

/** Para onde cada tipo de aviso leva ao ser clicado. */
const TARGETS: Partial<Record<Notification['type'], string>> = {
  BUDGET_EXCEEDED: '/budgets',
  GOAL_PROGRESS: '/goals',
  CARD_DUE: '/accounts?tab=cards',
  CARD_INVOICE_CLOSED: '/accounts?tab=cards',
  BILL_DUE: '/dashboard',
};

const TONES: Partial<Record<Notification['type'], string>> = {
  BUDGET_EXCEEDED: 'bg-danger/10 text-danger',
  GOAL_PROGRESS: 'bg-success/10 text-success',
  BILL_DUE: 'bg-warning/10 text-warning',
  CARD_DUE: 'bg-warning/10 text-warning',
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
  const router = useRouter();
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
        <div className="absolute right-0 z-40 mt-2 max-h-[28rem] w-[min(22rem,calc(100vw-1.5rem))] overflow-y-auto rounded-xl border border-border/70 bg-card shadow-lift animate-fade-in">
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
                    onClick={() => {
                      if (!n.read) markRead(n.id);
                      const target = TARGETS[n.type];
                      if (target) {
                        setOpen(false);
                        router.push(target);
                      }
                    }}
                    className={`flex items-start gap-3 px-3 py-3 text-left text-sm transition-theme hover:bg-muted ${
                      n.read ? '' : 'bg-primary/5'
                    }`}
                  >
                    <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${n.read ? 'bg-muted text-muted-foreground' : TONES[n.type] ?? 'bg-primary/10 text-primary'}`}>
                      <Icon className="h-4 w-4" strokeWidth={1.75} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className={n.read ? 'text-muted-foreground' : 'font-semibold'}>{n.title}</p>
                      <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{n.message}</p>
                      <p className="mt-1 text-[11px] text-muted-foreground">{timeAgo(n.createdAt)}</p>
                    </div>
                    {!n.read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />}
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
