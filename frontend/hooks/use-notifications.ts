import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api';

export interface Notification {
  id: string;
  type: 'BILL_DUE' | 'CARD_DUE' | 'GOAL_PROGRESS' | 'BUDGET_EXCEEDED' | 'SYSTEM';
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
}

function extractList(raw: any): Notification[] {
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw?.data)) return raw.data;
  return [];
}

export function useNotifications() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api.get('/notifications').then((r) => extractList(r.data)),
    refetchInterval: 60_000,
  });

  const notifications = query.data ?? [];
  const unreadCount = notifications.filter((n) => !n.read).length;

  const markRead = async (id: string) => {
    queryClient.setQueryData<Notification[]>(['notifications'], (prev) =>
      (prev ?? []).map((n) => (n.id === id ? { ...n, read: true } : n)),
    );
    try {
      await api.patch(`/notifications/${id}/read`);
    } finally {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    }
  };

  const markAllRead = async () => {
    queryClient.setQueryData<Notification[]>(['notifications'], (prev) =>
      (prev ?? []).map((n) => ({ ...n, read: true })),
    );
    try {
      await api.patch('/notifications/read-all');
    } finally {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    }
  };

  return { notifications, unreadCount, isLoading: query.isLoading, markRead, markAllRead };
}
