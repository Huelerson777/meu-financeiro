'use client';

import { useEffect, useRef, useState } from 'react';
import { api } from '@/services/api';
import { formatCurrency } from '@/utils/currency';

const formatDate = (value: string) => new Date(value).toLocaleDateString('pt-BR');

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

interface InstallmentItem {
  transactionId: string;
  installmentId: string | null;
  number: number | null;
  amount: number;
  dueDate: string;
  paid: boolean;
  paidAt: string | null;
}

interface InstallmentPurchase {
  installmentGroupId: string;
  description: string;
  categoryId?: string | null;
  category?: { name: string; color: string } | null;
  accountId?: string | null;
  account?: { name: string } | null;
  totalCount: number;
  installmentAmount: number;
  paidCount: number;
  remainingCount: number;
  nextDueDate: string | null;
  items: InstallmentItem[];
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
  const [activeTab, setActiveTab] = useState<'recurring' | 'installments'>('recurring');

  const [bills, setBills] = useState<RecurringBill[]>([]);
  const [purchases, setPurchases] = useState<InstallmentPurchase[]>([]);
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal: conta fixa
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

  // Modal: compra parcelada
  const [isInstallmentModalOpen, setIsInstallmentModalOpen] = useState(false);
  const [isSubmittingInstallment, setIsSubmittingInstallment] = useState(false);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [instDescription, setInstDescription] = useState('');
  const [instCategoryId, setInstCategoryId] = useState('');
  const [instAccountId, setInstAccountId] = useState('');
  const [instAmount, setInstAmount] = useState('');
  const [instTotalCount, setInstTotalCount] = useState('');
  const [instStartNumber, setInstStartNumber] = useState('1');
  const [instFirstDueDate, setInstFirstDueDate] = useState('');

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
      const [billsRes, purchasesRes, accRes, catRes] = await Promise.all([
        api.get('/recurring-bills').catch(() => ({ data: [] })),
        api.get('/installment-purchases').catch(() => ({ data: [] })),
        api.get('/accounts', { params: { limit: 100 } }).catch(() => ({ data: [] })),
        api.get('/categories').catch(() => ({ data: [] })),
      ]);
      setBills(extractList(billsRes.data));
      setPurchases(extractList(purchasesRes.data));
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
      await api.patch(`/recurring-bills/${b.id}`, { isActive: !b.isActive });
      fetchData();
    } catch {
      alert('Erro ao atualizar a conta fixa.');
    }
  };

  const handleDelete = async (b: RecurringBill) => {
    if (!window.confirm(`Tem certeza que deseja excluir a conta fixa "${b.description}"? Os lançamentos já gerados por ela são mantidos, só deixam de ser atualizados automaticamente.`)) return;
    try {
      await api.delete(`/recurring-bills/${b.id}`);
      fetchData();
    } catch {
      alert('Erro ao excluir a conta fixa.');
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

  const handleOpenCreateInstallment = () => {
    setEditingGroupId(null);
    setInstDescription('');
    setInstCategoryId('');
    setInstAccountId('');
    setInstAmount('');
    setInstTotalCount('');
    setInstStartNumber('1');
    setInstFirstDueDate('');
    setIsInstallmentModalOpen(true);
  };

  const handleEditPurchase = (p: InstallmentPurchase) => {
    // A edição recria as parcelas do zero (as já pagas são reembolsadas antes),
    // então o padrão é retomar exatamente de onde está: a próxima parcela em
    // aberto. Se não sobrou nenhuma em aberto, não tem o que editar.
    const nextOpen = p.items.find((i) => !i.paid);
    if (!nextOpen) {
      alert('Este parcelamento já está totalmente quitado, não há parcelas em aberto pra editar.');
      return;
    }
    setEditingGroupId(p.installmentGroupId);
    setInstDescription(p.description);
    setInstCategoryId(p.categoryId || '');
    setInstAccountId(p.accountId || '');
    setInstAmount(String(p.installmentAmount));
    setInstTotalCount(String(p.totalCount));
    setInstStartNumber(String(nextOpen.number ?? p.paidCount + 1));
    setInstFirstDueDate(nextOpen.dueDate.slice(0, 10));
    setIsInstallmentModalOpen(true);
  };

  const handleDeletePurchase = async (p: InstallmentPurchase) => {
    if (!window.confirm(`Excluir "${p.description}"? Isso remove todas as ${p.items.length} parcelas lançadas (as já pagas devolvem o valor pra conta de onde saíram).`)) return;
    try {
      await api.delete(`/installment-purchases/${p.installmentGroupId}`);
      fetchData();
    } catch {
      alert('Erro ao excluir o parcelamento.');
    }
  };

  const handleSubmitInstallment = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingInstallment(true);
    try {
      const payload = {
        description: instDescription,
        categoryId: instCategoryId || undefined,
        accountId: instAccountId || undefined,
        installmentAmount: parseFloat(instAmount),
        totalInstallments: parseInt(instTotalCount, 10),
        startInstallment: instStartNumber ? parseInt(instStartNumber, 10) : undefined,
        firstDueDate: instFirstDueDate,
      };

      if (editingGroupId) {
        await api.patch(`/installment-purchases/${editingGroupId}`, payload);
      } else {
        await api.post('/installment-purchases', payload);
      }

      setIsInstallmentModalOpen(false);
      fetchData();
    } catch (err: any) {
      const msg = err.response?.data?.message;
      alert(Array.isArray(msg) ? msg.join('\n') : msg || 'Erro ao salvar o parcelamento.');
    } finally {
      setIsSubmittingInstallment(false);
    }
  };

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold dark:text-white">Contas Fixas</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {activeTab === 'recurring'
              ? 'Cadastre suas contas mensais (aluguel, internet, energia...) e elas aparecem sozinhas em "Em Aberto" todo mês, prontas pra você informar o valor e pagar.'
              : 'Cadastre financiamentos e boletos parcelados (ex: carro, imóvel) — as parcelas aparecem em "Em Aberto" no Dashboard, uma por mês, até acabar.'}
          </p>
        </div>
        <button
          onClick={activeTab === 'recurring' ? handleOpenCreate : handleOpenCreateInstallment}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium shadow transition shrink-0"
        >
          {activeTab === 'recurring' ? '+ Nova Conta Fixa' : '+ Nova Compra Parcelada'}
        </button>
      </div>

      <div className="flex gap-2 mb-4 border-b border-gray-200 dark:border-zinc-800">
        <button
          onClick={() => setActiveTab('recurring')}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition ${
            activeTab === 'recurring'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
          }`}
        >
          Recorrentes
        </button>
        <button
          onClick={() => setActiveTab('installments')}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition ${
            activeTab === 'installments'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
          }`}
        >
          Parceladas
        </button>
      </div>

      <div className="bg-white dark:bg-zinc-900 rounded-xl shadow border border-gray-100 dark:border-zinc-800 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Carregando...</div>
        ) : activeTab === 'recurring' ? (
          bills.length === 0 ? (
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
                        <button onClick={() => handleDelete(b)} className="text-red-500 hover:text-red-700 text-sm font-medium">
                          Excluir
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        ) : purchases.length === 0 ? (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400">
            Nenhuma compra parcelada cadastrada ainda. Que tal lançar o financiamento do carro ou de um boleto?
          </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-800/50">
                <th className="p-4 font-semibold dark:text-gray-200">Descrição</th>
                <th className="p-4 font-semibold dark:text-gray-200">Conta padrão</th>
                <th className="p-4 font-semibold dark:text-gray-200">Progresso</th>
                <th className="p-4 font-semibold dark:text-gray-200">Próximo vencimento</th>
                <th className="p-4 font-semibold text-right dark:text-gray-200">Valor da parcela</th>
                <th className="p-4 font-semibold text-center dark:text-gray-200">Ações</th>
              </tr>
            </thead>
            <tbody>
              {purchases.map((p) => (
                <tr key={p.installmentGroupId} className="border-b border-gray-100 dark:border-zinc-800 hover:bg-gray-50/50 dark:hover:bg-zinc-800/50 group">
                  <td className="p-4 dark:text-gray-200 font-medium">
                    {p.description}
                    {p.category && (
                      <span
                        className="ml-2 inline-flex items-center text-xs font-normal px-2 py-0.5 rounded-full"
                        style={{ backgroundColor: `${p.category.color}20`, color: p.category.color }}
                      >
                        {p.category.name}
                      </span>
                    )}
                  </td>
                  <td className="p-4 text-gray-500 dark:text-gray-400 text-sm">
                    {p.account?.name || 'Escolher ao pagar'}
                  </td>
                  <td className="p-4 text-gray-500 dark:text-gray-400 text-sm">
                    {p.paidCount}/{p.totalCount} pagas
                    {p.remainingCount === 0 && (
                      <span className="ml-2 text-xs font-bold text-green-600 dark:text-green-400">Quitado</span>
                    )}
                  </td>
                  <td className="p-4 text-gray-500 dark:text-gray-400 text-sm">
                    {p.nextDueDate ? formatDate(p.nextDueDate) : '—'}
                  </td>
                  <td className="p-4 text-right text-sm dark:text-gray-200">
                    {formatCurrency(p.installmentAmount)}
                  </td>
                  <td className="p-4 text-center">
                    <div className="flex justify-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => handleEditPurchase(p)} className="text-blue-500 hover:text-blue-700 text-sm font-medium">
                        Editar
                      </button>
                      <button onClick={() => handleDeletePurchase(p)} className="text-red-500 hover:text-red-700 text-sm font-medium">
                        Excluir
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

      {isInstallmentModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-xl w-full max-w-md p-6 border border-gray-200 dark:border-zinc-800">
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-xl font-bold dark:text-white">
                {editingGroupId ? 'Editar Compra Parcelada' : 'Nova Compra Parcelada'}
              </h2>
              <button onClick={() => setIsInstallmentModalOpen(false)} className="text-gray-500 hover:text-gray-700 font-bold text-lg">✕</button>
            </div>

            <form onSubmit={handleSubmitInstallment} className="space-y-4">
              <div>
                <label className="block text-sm font-medium dark:text-gray-300 mb-1">Descrição</label>
                <input
                  type="text" required placeholder="Ex: Financiamento do carro, Boleto do sofá..."
                  value={instDescription} onChange={(e) => setInstDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-700 rounded-lg bg-transparent dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium dark:text-gray-300 mb-1">Categoria</label>
                <select
                  value={instCategoryId} onChange={(e) => setInstCategoryId(e.target.value)}
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
                  value={instAccountId} onChange={(e) => setInstAccountId(e.target.value)}
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
                  <label className="block text-sm font-medium dark:text-gray-300 mb-1">Valor da parcela</label>
                  <input
                    type="number" step="0.01" required placeholder="Ex: 850,00"
                    value={instAmount} onChange={(e) => setInstAmount(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-700 rounded-lg bg-transparent dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium dark:text-gray-300 mb-1">Total de parcelas</label>
                  <input
                    type="number" min="1" required placeholder="Ex: 60"
                    value={instTotalCount} onChange={(e) => setInstTotalCount(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-700 rounded-lg bg-transparent dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium dark:text-gray-300 mb-1">
                    Parcela inicial
                  </label>
                  <input
                    type="number" min="1" required
                    value={instStartNumber} onChange={(e) => setInstStartNumber(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-700 rounded-lg bg-transparent dark:text-white"
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    {editingGroupId
                      ? 'Pré-preenchido com a próxima parcela em aberto — ajuste se precisar.'
                      : 'Já está pagando? Coloque o nº da parcela atual (ex: 5)'}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium dark:text-gray-300 mb-1">
                    Vencimento da parcela inicial
                  </label>
                  <input
                    type="date" required
                    value={instFirstDueDate} onChange={(e) => setInstFirstDueDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-700 rounded-lg bg-transparent dark:text-white"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3">
                <button type="button" onClick={() => setIsInstallmentModalOpen(false)} className="px-4 py-2 text-sm text-gray-500 hover:underline">Cancelar</button>
                <button type="submit" disabled={isSubmittingInstallment} className="px-5 py-2 rounded-lg text-sm font-semibold text-white shadow bg-blue-600 hover:bg-blue-700">
                  {isSubmittingInstallment ? 'Salvando...' : 'Confirmar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
