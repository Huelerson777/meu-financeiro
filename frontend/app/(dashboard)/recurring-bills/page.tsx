'use client';

import { useEffect, useRef, useState } from 'react';
import { api } from '@/services/api';
import { formatCurrency } from '@/utils/currency';

interface RecurringBill {
  id: string;
  description: string;
  categoryId?: string | null;
  category?: { name: string; color: string } | null;
  accountId?: string | null;
  account?: { name: string } | null;
  defaultAmount: number | string | null;
  dueDay: number;
  isActive: boolean;
}

interface AccountOption {
  id: string;
  name: string;
}

interface CategoryOption {
  id: string;
  name: string;
  color: string;
}

const extractList = (raw: any) => {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw.data)) return raw.data;
  if (Array.isArray(raw.items)) return raw.items;
  if (Array.isArray(raw.data?.items)) return raw.data.items;
  return [];
};

export default function RecurringBillsPage() {
  const [bills, setBills] = useState<RecurringBill[]>([]);
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [loading, setLoading] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [categoryAutoSuggested, setCategoryAutoSuggested] = useState(false);
  const [accountId, setAccountId] = useState('');
  const [defaultAmount, setDefaultAmount] = useState('');
  const [dueDay, setDueDay] = useState('10');
  const suggestTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleDescriptionChange = (value: string) => {
    setDescription(value);
    if (suggestTimeoutRef.current) clearTimeout(suggestTimeoutRef.current);
    if (value.trim().length < 3) return;

    suggestTimeoutRef.current = setTimeout(async () => {
      try {
        const res = await api.get('/transactions/suggest-category', { params: { description: value } });
        const suggestion = res.data?.data ?? res.data;
        if (suggestion?.categoryId && (categoryId === '' || categoryAutoSuggested)) {
          setCategoryId(suggestion.categoryId);
          setCategoryAutoSuggested(true);
        }
      } catch {
        // silencioso — sugestão é um "nice to have", não pode travar o formulário
      }
    }, 500);
  };

  const handleCategoryChange = (value: string) => {
    setCategoryId(value);
    setCategoryAutoSuggested(false);
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const [billsRes, accRes, catRes] = await Promise.all([
        api.get('/recurring-bills').catch(() => ({ data: [] })),
        api.get('/accounts', { params: { limit: 100 } }).catch(() => ({ data: [] })),
        api.get('/categories').catch(() => ({ data: [] })),
      ]);
      setBills(extractList(billsRes.data));
      setAccounts(extractList(accRes.data));
      setCategories(extractList(catRes.data));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleOpenCreate = () => {
    setEditingId(null);
    setDescription('');
    setCategoryId('');
    setCategoryAutoSuggested(false);
    setAccountId('');
    setDefaultAmount('');
    setDueDay('10');
    setIsModalOpen(true);
  };

  const handleEdit = (b: RecurringBill) => {
    setEditingId(b.id);
    setDescription(b.description);
    setCategoryId(b.categoryId || '');
    setCategoryAutoSuggested(false);
    setAccountId(b.accountId || '');
    setDefaultAmount(b.defaultAmount != null ? String(b.defaultAmount) : '');
    setDueDay(String(b.dueDay));
    setIsModalOpen(true);
  };

  const handleTogglePause = async (b: RecurringBill) => {
    try {
      if (b.isActive) {
        await api.delete(`/recurring-bills/${b.id}`);
      } else {
        await api.patch(`/recurring-bills/${b.id}`, { isActive: true });
      }
      fetchData();
    } catch {
      alert('Erro ao atualizar a conta fixa.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const payload = {
        description,
        categoryId: categoryId || undefined,
        accountId: accountId || undefined,
        defaultAmount: defaultAmount ? parseFloat(defaultAmount) : undefined,
        dueDay: parseInt(dueDay, 10),
      };

      if (editingId) {
        await api.patch(`/recurring-bills/${editingId}`, payload);
      } else {
        await api.post('/recurring-bills', payload);
      }

      setIsModalOpen(false);
      // Já cria/atualiza o lançamento do mês corrente pra refletir a mudança na hora.
      await api.post('/recurring-bills/sync').catch(() => {});
      fetchData();
    } catch (err: any) {
      const msg = err.response?.data?.message;
      alert(Array.isArray(msg) ? msg.join('\n') : msg || 'Erro ao salvar conta fixa.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold dark:text-white">Contas Fixas</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Cadastre suas contas mensais (aluguel, internet, energia...) e elas aparecem sozinhas em
            "Em Aberto" todo mês, prontas pra você informar o valor e pagar.
          </p>
        </div>
        <button
          onClick={handleOpenCreate}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium shadow transition shrink-0"
        >
          + Nova Conta Fixa
        </button>
      </div>

      <div className="bg-white dark:bg-zinc-900 rounded-xl shadow border border-gray-100 dark:border-zinc-800 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Carregando...</div>
        ) : bills.length === 0 ? (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400">
            Nenhuma conta fixa cadastrada ainda. Que tal começar com o aluguel ou a internet?
          </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-800/50">
                <th className="p-4 font-semibold dark:text-gray-200">Descrição</th>
                <th className="p-4 font-semibold dark:text-gray-200">Conta padrão</th>
                <th className="p-4 font-semibold dark:text-gray-200">Vencimento</th>
                <th className="p-4 font-semibold text-right dark:text-gray-200">Valor padrão</th>
                <th className="p-4 font-semibold text-center dark:text-gray-200">Status</th>
                <th className="p-4 font-semibold text-center dark:text-gray-200">Ações</th>
              </tr>
            </thead>
            <tbody>
              {bills.map((b) => (
                <tr key={b.id} className="border-b border-gray-100 dark:border-zinc-800 hover:bg-gray-50/50 dark:hover:bg-zinc-800/50 group">
                  <td className="p-4 dark:text-gray-200 font-medium">
                    {b.description}
                    {b.category && (
                      <span
                        className="ml-2 inline-flex items-center text-xs font-normal px-2 py-0.5 rounded-full"
                        style={{ backgroundColor: `${b.category.color}20`, color: b.category.color }}
                      >
                        {b.category.name}
                      </span>
                    )}
                  </td>
                  <td className="p-4 text-gray-500 dark:text-gray-400 text-sm">
                    {b.account?.name || 'Escolher ao pagar'}
                  </td>
                  <td className="p-4 text-gray-500 dark:text-gray-400 text-sm">dia {b.dueDay}</td>
                  <td className="p-4 text-right text-sm dark:text-gray-200">
                    {b.defaultAmount != null ? formatCurrency(Number(b.defaultAmount)) : 'variável'}
                  </td>
                  <td className="p-4 text-center">
                    <span className={`text-xs font-bold px-2 py-1 rounded ${
                      b.isActive
                        ? 'bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400'
                        : 'bg-gray-100 text-gray-500 dark:bg-zinc-800 dark:text-gray-400'
                    }`}>
                      {b.isActive ? 'Ativa' : 'Pausada'}
                    </span>
                  </td>
                  <td className="p-4 text-center">
                    <div className="flex justify-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => handleEdit(b)} className="text-blue-500 hover:text-blue-700 text-sm font-medium">
                        Editar
                      </button>
                      <button onClick={() => handleTogglePause(b)} className="text-amber-500 hover:text-amber-700 text-sm font-medium">
                        {b.isActive ? 'Pausar' : 'Reativar'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-xl w-full max-w-md p-6 border border-gray-200 dark:border-zinc-800">
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-xl font-bold dark:text-white">
                {editingId ? 'Editar Conta Fixa' : 'Nova Conta Fixa'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-500 hover:text-gray-700 font-bold text-lg">✕</button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium dark:text-gray-300 mb-1">Descrição</label>
                <input
                  type="text" required placeholder="Ex: Aluguel, TIM, Internet, Energia..."
                  value={description} onChange={(e) => handleDescriptionChange(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-700 rounded-lg bg-transparent dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium dark:text-gray-300 mb-1">
                  Categoria
                  {categoryAutoSuggested && categoryId && (
                    <span className="ml-1 text-xs font-normal text-blue-500">· sugerida</span>
                  )}
                </label>
                <select
                  value={categoryId} onChange={(e) => handleCategoryChange(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 dark:text-white"
                >
                  <option value="">Sem categoria</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium dark:text-gray-300 mb-1">
                  Conta padrão <span className="text-xs font-normal text-gray-400">(opcional)</span>
                </label>
                <select
                  value={accountId} onChange={(e) => setAccountId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 dark:text-white"
                >
                  <option value="">Escolher na hora de pagar</option>
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>{acc.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium dark:text-gray-300 mb-1">
                    Valor padrão <span className="text-xs font-normal text-gray-400">(opcional)</span>
                  </label>
                  <input
                    type="number" step="0.01" placeholder="Ex: 89,90"
                    value={defaultAmount} onChange={(e) => setDefaultAmount(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-700 rounded-lg bg-transparent dark:text-white"
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    Vazio = repete o valor do último pagamento
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium dark:text-gray-300 mb-1">Dia do vencimento</label>
                  <input
                    type="number" min="1" max="31" required
                    value={dueDay} onChange={(e) => setDueDay(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-700 rounded-lg bg-transparent dark:text-white"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm text-gray-500 hover:underline">Cancelar</button>
                <button type="submit" disabled={isSubmitting} className="px-5 py-2 rounded-lg text-sm font-semibold text-white shadow bg-blue-600 hover:bg-blue-700">
                  {isSubmitting ? 'Salvando...' : 'Confirmar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
