'use client';

import { notifyAlert } from '@/utils/notify';
import { useEffect, useState } from 'react';
import { api } from '@/services/api';

interface FeedbackItem {
  id: string;
  screen: string;
  message: string;
  image?: string | null;
  status: 'OPEN' | 'RESOLVED';
  createdAt: string;
  user: { name: string; email: string };
}

const extractList = (raw: any): FeedbackItem[] => {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw.data?.items)) return raw.data.items;
  if (Array.isArray(raw.items)) return raw.items;
  if (Array.isArray(raw.data)) return raw.data;
  return [];
};

// createdAt é um instante real (não uma data "só dia" como um vencimento),
// então aqui o certo é converter pro fuso local de quem está vendo — ao
// contrário de datas de vencimento, que devem ficar fixas independente do
// fuso (ver formatDate no restante do app).
const formatDateTime = (value: string) =>
  `${new Date(value).toLocaleDateString('pt-BR')} ${new Date(value).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;

export default function FeedbackPage() {
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'' | 'OPEN' | 'RESOLVED'>('OPEN');
  const [viewingImage, setViewingImage] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setForbidden(false);
    try {
      const res = await api.get('/feedback', { params: { limit: 100, ...(statusFilter ? { status: statusFilter } : {}) } });
      setItems(extractList(res.data));
    } catch (err: any) {
      if (err.response?.status === 403) {
        setForbidden(true);
      } else {
        setItems([]);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const handleToggleStatus = async (item: FeedbackItem) => {
    const newStatus = item.status === 'OPEN' ? 'RESOLVED' : 'OPEN';
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, status: newStatus } : i)));
    try {
      await api.patch(`/feedback/${item.id}`, { status: newStatus });
      if (statusFilter && newStatus !== statusFilter) {
        setItems((prev) => prev.filter((i) => i.id !== item.id));
      }
    } catch {
      notifyAlert('Erro ao atualizar o status.');
      fetchData();
    }
  };

  if (forbidden) {
    return (
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight">Feedbacks</h1>
        <p className="mt-4 text-foreground">
          Você não tem permissão para ver esta página.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Feedbacks</h1>
          <p className="mt-1 text-sm text-foreground">
            Feedbacks, dúvidas e sugestões enviados pelos usuários.
          </p>
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as any)}
          className="rounded-lg border border-input bg-card px-3 py-2 text-sm"
        >
          <option value="OPEN">Abertos</option>
          <option value="RESOLVED">Resolvidos</option>
          <option value="">Todos</option>
        </select>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow">
        {loading ? (
          <div className="p-8 text-center text-foreground">Carregando...</div>
        ) : items.length === 0 ? (
          <div className="p-8 text-center text-foreground">Nenhum feedback por aqui.</div>
        ) : (
          <>
          <ul className="divide-y divide-border md:hidden">
            {items.map((item) => (
              <li key={item.id} className="flex flex-col gap-2 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{item.user?.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{formatDateTime(item.createdAt)} · {item.screen}</p>
                  </div>
                  <span className={`shrink-0 rounded-md px-2 py-0.5 text-[11px] font-semibold ${item.status === 'OPEN' ? 'bg-warning/10 text-warning' : 'bg-success/10 text-success'}`}>
                    {item.status === 'OPEN' ? 'Aberto' : 'Resolvido'}
                  </span>
                </div>
                <p className="text-sm leading-relaxed text-foreground/80">{item.message}</p>
                {item.image && (
                  <button type="button" onClick={() => setViewingImage(item.image!)} className="block w-fit">
                    <img src={item.image} alt="Print anexado" className="h-16 w-16 rounded-md border border-border object-cover" />
                  </button>
                )}
                <button onClick={() => handleToggleStatus(item)} className="w-fit py-1 text-sm font-semibold text-primary">
                  {item.status === 'OPEN' ? 'Marcar resolvido' : 'Reabrir'}
                </button>
              </li>
            ))}
          </ul>
          <div className="hidden overflow-x-auto md:block"><table className="min-w-[640px] w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border bg-muted/60">
                <th className="p-4 font-semibold">Quando</th>
                <th className="p-4 font-semibold">Usuário</th>
                <th className="p-4 font-semibold">Tela</th>
                <th className="p-4 font-semibold">Mensagem</th>
                <th className="p-4 text-center font-semibold">Status</th>
                <th className="p-4 text-center font-semibold">Ações</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b border-border align-top">
                  <td className="whitespace-nowrap p-4 text-sm text-foreground">
                    {formatDateTime(item.createdAt)}
                  </td>
                  <td className="p-4 text-sm">
                    <p className="font-medium">{item.user?.name}</p>
                    <p className="text-xs text-foreground">{item.user?.email}</p>
                  </td>
                  <td className="p-4 text-sm">
                    <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                      {item.screen}
                    </span>
                  </td>
                  <td className="p-4 max-w-md text-sm text-foreground/80">
                    <p>{item.message}</p>
                    {item.image && (
                      <button type="button" onClick={() => setViewingImage(item.image!)} className="mt-2 block">
                        <img
                          src={item.image}
                          alt="Print anexado"
                          className="h-16 w-16 rounded-md border border-border object-cover hover:opacity-80"
                        />
                      </button>
                    )}
                  </td>
                  <td className="p-4 text-center">
                    <span
                      className={`rounded px-2 py-1 text-xs font-bold ${
                        item.status === 'OPEN'
                          ? 'bg-warning/10 text-warning'
                          : 'bg-success/10 text-success'
                      }`}
                    >
                      {item.status === 'OPEN' ? 'Aberto' : 'Resolvido'}
                    </span>
                  </td>
                  <td className="p-4 text-center">
                    <button
                      onClick={() => handleToggleStatus(item)}
                      className="text-sm font-medium text-primary hover:text-primary"
                    >
                      {item.status === 'OPEN' ? 'Marcar resolvido' : 'Reabrir'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>
          </>
        )}
      </div>

      {viewingImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6"
          onClick={() => setViewingImage(null)}
        >
          <img src={viewingImage} alt="Print anexado (tamanho real)" className="max-h-full max-w-full rounded-lg shadow-2xl" />
        </div>
      )}
    </div>
  );
}
