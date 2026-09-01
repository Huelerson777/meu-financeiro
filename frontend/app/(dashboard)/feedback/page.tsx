'use client';

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
      alert('Erro ao atualizar o status.');
      fetchData();
    }
  };

  if (forbidden) {
    return (
      <div className="p-8">
        <h1 className="text-3xl font-bold dark:text-white">Feedbacks</h1>
        <p className="mt-4 text-gray-500 dark:text-gray-400">
          Você não tem permissão para ver esta página.
        </p>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold dark:text-white">Feedbacks</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Feedbacks, dúvidas e sugestões enviados pelos usuários.
          </p>
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as any)}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
        >
          <option value="OPEN">Abertos</option>
          <option value="RESOLVED">Resolvidos</option>
          <option value="">Todos</option>
        </select>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow dark:border-zinc-800 dark:bg-zinc-900">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Carregando...</div>
        ) : items.length === 0 ? (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400">Nenhum feedback por aqui.</div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 dark:border-zinc-800 dark:bg-zinc-800/50">
                <th className="p-4 font-semibold dark:text-gray-200">Quando</th>
                <th className="p-4 font-semibold dark:text-gray-200">Usuário</th>
                <th className="p-4 font-semibold dark:text-gray-200">Tela</th>
                <th className="p-4 font-semibold dark:text-gray-200">Mensagem</th>
                <th className="p-4 text-center font-semibold dark:text-gray-200">Status</th>
                <th className="p-4 text-center font-semibold dark:text-gray-200">Ações</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b border-gray-100 align-top dark:border-zinc-800">
                  <td className="whitespace-nowrap p-4 text-sm text-gray-500 dark:text-gray-400">
                    {formatDateTime(item.createdAt)}
                  </td>
                  <td className="p-4 text-sm">
                    <p className="font-medium dark:text-gray-200">{item.user?.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{item.user?.email}</p>
                  </td>
                  <td className="p-4 text-sm">
                    <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-600 dark:bg-blue-900/30 dark:text-blue-300">
                      {item.screen}
                    </span>
                  </td>
                  <td className="p-4 max-w-md text-sm text-gray-700 dark:text-gray-300">
                    <p>{item.message}</p>
                    {item.image && (
                      <button type="button" onClick={() => setViewingImage(item.image!)} className="mt-2 block">
                        <img
                          src={item.image}
                          alt="Print anexado"
                          className="h-16 w-16 rounded-md border border-gray-200 object-cover hover:opacity-80 dark:border-zinc-700"
                        />
                      </button>
                    )}
                  </td>
                  <td className="p-4 text-center">
                    <span
                      className={`rounded px-2 py-1 text-xs font-bold ${
                        item.status === 'OPEN'
                          ? 'bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400'
                          : 'bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400'
                      }`}
                    >
                      {item.status === 'OPEN' ? 'Aberto' : 'Resolvido'}
                    </span>
                  </td>
                  <td className="p-4 text-center">
                    <button
                      onClick={() => handleToggleStatus(item)}
                      className="text-sm font-medium text-blue-500 hover:text-blue-700"
                    >
                      {item.status === 'OPEN' ? 'Marcar resolvido' : 'Reabrir'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
