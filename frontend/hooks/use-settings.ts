import { useQuery } from '@tanstack/react-query';
import { api } from '@/services/api';

export interface UserSettings {
  theme: string;
  language: string;
  currency: string;
  dashboardWidgets: string[] | null;
  dashboardHiddenAccountIds: string[] | null;
}

export function useSettings() {
  return useQuery({
    queryKey: ['settings'],
    queryFn: () => api.get('/settings').then((r) => (r.data?.data ?? r.data) as UserSettings),
  });
}
