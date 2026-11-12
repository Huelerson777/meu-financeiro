'use client';

import Link from 'next/link';
import { AccountAvatar } from '@/components/accounts/account-avatar';
import { effectiveDate, isEffectivelyPaid } from '@/utils/transaction-status';
import { notifyAlert, confirmDialog } from '@/utils/notify';
import React, { ReactNode, Suspense, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  X, ArrowDownLeft, ArrowUpRight, ArrowLeftRight, CalendarRange, ChevronLeft, ChevronRight, ExternalLink,
  CreditCard, Plus, Search, SlidersHorizontal, Trash2, TrendingUp, Upload,
} from 'lucide-react';
import { api } from '@/services/api';
import { todayLocalISO } from '@/utils/date';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Chip } from '@/components/ui/chip';
import { Segmented } from '@/components/ui/segmented';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { formatCurrency } from '@/utils/currency';

const fieldClass =
  'h-10 rounded-xl border border-input bg-card px-3 text-sm text-foreground transition-theme focus-visible:border-primary focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/15';

// Investir só pela tela de Investimentos agora — aqui só dá pra editar/ver
// aportes já existentes (por isso "INVESTMENT" continua em TYPE_FILTER_OPTIONS,
// TYPE_HELP e no tipo de uiType, mas sumiu de TYPE_OPTIONS).
const TYPE_OPTIONS = [
  { value: 'EXPENSE', label: 'Saída', icon: ArrowUpRight, activeClass: 'text-danger' },
  { value: 'INCOME', label: 'Entrada', icon: ArrowDownLeft, activeClass: 'text-success' },
  { value: 'TRANSFER', label: 'Transferência', icon: ArrowLeftRight, activeClass: 'text-warning' },
] as const;

const TYPE_FILTER_OPTIONS = [
  { value: 'INCOME', label: 'Entradas' },
  { value: 'EXPENSE', label: 'Saídas' },
  { value: 'TRANSFER', label: 'Transferências' },
  { value: 'INVESTMENT', label: 'Investimentos' },
];

const TYPE_HELP: Record<'INCOME' | 'EXPENSE' | 'TRANSFER' | 'INVESTMENT', string> = {
  EXPENSE: 'Quanto saiu (ou vai sair)?',
  INCOME: 'Quanto entrou (ou vai entrar)?',
  TRANSFER: 'Quanto vai de uma conta para outra?',
  INVESTMENT: 'Valor do aporte',
};

interface Transaction {
  id: string;
  description: string;
  amount: number | string;
  type: 'INCOME' | 'EXPENSE' | 'TRANSFER';
  status: 'PAID' | 'PENDING' | 'OVERDUE';
  date: string;
  accountId?: string;
  account?: { name: string };
  categoryId?: string | null;
  category?: { name: string; color: string } | null;
  transfer?: { id: string; toId: string; toAccount?: { name: string; type: string } } | null;
  installments?: { paid: boolean; paidAt?: string | null }[] | null;
  cardId?: string | null;
}

// Parcela de compra no cartão ou de parcelamento: valor, pagamento e exclusão
// passam pela fatura/parcelamento (que devolvem limite e saldo junto). Editar
// ou excluir por esta tela mexeria só no lançamento e deixaria o resto errado —
// o backend recusa, então aqui a linha aponta pro lugar certo em vez dos botões.
function installmentSource(t: Transaction): { href: string; label: string } | null {
  if (!t.installments || t.installments.length === 0) return null;
  return t.cardId
    ? { href: '/cards', label: 'Ver na fatura' }
    : { href: '/recurring-bills', label: 'Ver parcelamento' };
}

interface AccountOption {
  id: string;
  name: string;
  type: string;
  currentBalance?: number | string;
  color?: string;
  icon?: string;
}

interface CardOption {
  id: string;
  name: string;
  color?: string;
  icon?: string;
  limitAmount: number | string;
  usedLimit: number | string;
}

const INSTALLMENT_CHOICES = [1, 2, 3, 4, 6, 10, 12];

interface CategoryOption {
  id: string;
  name: string;
  color: string;
}

// Sem filtro nenhum, parcelas de cartão futuras (que podem ir anos à frente)
// dominam o topo da lista por ordenação de data — por isso o período padrão
// é o mês atual, igual o Dashboard já faz. "Limpar período" mostra tudo.
function currentMonthRange() {
  const now = new Date();
  return {
    start: todayLocalISO(new Date(now.getFullYear(), now.getMonth(), 1)),
    end: todayLocalISO(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
  };
}

// Dia local em "AAAA-MM-DD" a partir de uma data (mesma regra de todayLocalISO)
const localISO = (d: Date) => todayLocalISO(d);

// Atalhos de período — o que antes exigia preencher "De" e "Até" na mão.
// "Tudo" equivale ao antigo "Limpar período".
const PERIOD_PRESETS: { key: string; label: string; range: () => { start: string; end: string } }[] = [
  { key: 'month', label: 'Este mês', range: currentMonthRange },
  {
    key: 'last-month',
    label: 'Mês passado',
    range: () => {
      const now = new Date();
      return {
        start: localISO(new Date(now.getFullYear(), now.getMonth() - 1, 1)),
        end: localISO(new Date(now.getFullYear(), now.getMonth(), 0)),
      };
    },
  },
  {
    key: '90d',
    label: '90 dias',
    range: () => {
      const start = new Date();
      start.setDate(start.getDate() - 89);
      return { start: localISO(start), end: todayLocalISO() };
    },
  },
  { key: 'all', label: 'Tudo', range: () => ({ start: '', end: '' }) },
];

const QUICK_DATES: { label: string; value: () => string }[] = [
  { label: 'Hoje', value: () => todayLocalISO() },
  {
    label: 'Ontem',
    value: () => {
      const d = new Date();
      d.setDate(d.getDate() - 1);
      return todayLocalISO(d);
    },
  },
];

function dayLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((startOf(today) - startOf(d)) / 86_400_000);
  if (diff === 0) return 'Hoje';
  if (diff === 1) return 'Ontem';
  if (diff === -1) return 'Amanhã';
  return d.toLocaleDateString('pt-BR', {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
    ...(d.getFullYear() !== today.getFullYear() ? { year: 'numeric' as const } : {}),
  });
}

/** Linha do formulário: rótulo pequeno em cima, opções em chips embaixo. */
function FormRow({ label, hint, hintTone, children }: { label: string; hint?: string; hintTone?: 'primary'; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-xs font-semibold text-muted-foreground">{label}</span>
        {hint && <span className={`truncate text-xs ${hintTone === 'primary' ? 'font-medium text-primary' : 'text-muted-foreground'}`}>{hint}</span>}
      </div>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}

// Conta que já vem marcada num lançamento novo: a primeira do dia a dia —
// conta de investimento só entra como padrão se for a única que existe.
function defaultAccount<T extends { type: string }>(list: T[]): T {
  return list.find((a) => a.type !== 'INVESTMENT') ?? list[0];
}

function TransactionsPageContent() {
  // Chegando aqui pelo card de categoria do dashboard, a URL já vem com
  // ?categoryId=...&startDate=...&endDate=... — usamos isso como filtro inicial
  const searchParams = useSearchParams();
  const router = useRouter();

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [loading, setLoading] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTransferId, setEditingTransferId] = useState<string | null>(null);

  // Filtro de período, categoria e tipo
  const [startDate, setStartDate] = useState(() => searchParams.get('startDate') ?? currentMonthRange().start);
  const [endDate, setEndDate] = useState(() => searchParams.get('endDate') ?? currentMonthRange().end);
  const [categoryFilter, setCategoryFilter] = useState(() => searchParams.get('categoryId') ?? '');
  const [typeFilters, setTypeFilters] = useState<string[]>([]);
  // Datas exatas e valor ficam recolhidos até o usuário pedir
  const [customPeriodOpen, setCustomPeriodOpen] = useState(false);
  const [amountOpen, setAmountOpen] = useState(false);

  const toggleTypeFilter = (value: string) => {
    setTypeFilters((prev) => (prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]));
    setPage(1);
  };

  // Descrição e valor filtram com um pequeno atraso (debounce) pra não
  // disparar uma busca a cada tecla digitada.
  const [descriptionInput, setDescriptionInput] = useState('');
  const [descriptionFilter, setDescriptionFilter] = useState('');
  const [amountInput, setAmountInput] = useState('');
  const [amountFilter, setAmountFilter] = useState('');

  useEffect(() => {
    const t = setTimeout(() => { setDescriptionFilter(descriptionInput.trim()); setPage(1); }, 500);
    return () => clearTimeout(t);
  }, [descriptionInput]);

  useEffect(() => {
    const t = setTimeout(() => { setAmountFilter(amountInput.trim()); setPage(1); }, 500);
    return () => clearTimeout(t);
  }, [amountInput]);

  // Paginação
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = 20;

  // Form State
  const [uiType, setUiType] = useState<'INCOME' | 'EXPENSE' | 'TRANSFER' | 'INVESTMENT'>('EXPENSE');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [accountId, setAccountId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [destinationAccountId, setDestinationAccountId] = useState('');
  // Compra no cartão direto pelo lançamento (antes só dava pela tela do cartão)
  const [cards, setCards] = useState<CardOption[]>([]);
  const [cardId, setCardId] = useState('');
  const [installmentsCount, setInstallmentsCount] = useState(1);
  const [status, setStatus] = useState<'PAID' | 'PENDING'>('PAID');
  const [date, setDate] = useState(todayLocalISO());

  // Sugestão automática de categoria: só sobrescreve o campo enquanto o
  // valor ali dentro ainda for uma sugestão (não uma escolha manual do usuário).
  const [categoryAutoSuggested, setCategoryAutoSuggested] = useState(false);
  const suggestTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleDescriptionChange = (value: string) => {
    setDescription(value);
    if (suggestTimeoutRef.current) clearTimeout(suggestTimeoutRef.current);

    if ((uiType !== 'EXPENSE' && uiType !== 'INCOME') || value.trim().length < 3) return;

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

  const extractList = (rawResponse: any) => {
    if (!rawResponse) return [];
    if (Array.isArray(rawResponse)) return rawResponse;
    if (Array.isArray(rawResponse.data)) return rawResponse.data;
    if (Array.isArray(rawResponse.items)) return rawResponse.items;
    if (Array.isArray(rawResponse.accounts)) return rawResponse.accounts;
    if (Array.isArray(rawResponse.data?.accounts)) return rawResponse.data.accounts;
    if (Array.isArray(rawResponse.data?.items)) return rawResponse.data.items;
    if (Array.isArray(rawResponse.data?.data)) return rawResponse.data.data;
    return [];
  };

  const extractMeta = (rawResponse: any) => {
    return rawResponse?.data?.meta ?? rawResponse?.meta ?? null;
  };

  const fetchData = async () => {
    try {
      setLoading(true);

      const transactionsParams: Record<string, string | number> = { page, limit: pageSize };
      if (startDate) transactionsParams.startDate = startDate;
      if (endDate) transactionsParams.endDate = endDate;
      if (categoryFilter) transactionsParams.categoryId = categoryFilter;
      if (typeFilters.length > 0) transactionsParams.type = typeFilters.join(',');
      if (descriptionFilter) transactionsParams.search = descriptionFilter;
      if (amountFilter) transactionsParams.amount = amountFilter;

      const [transRes, accRes, catRes, cardRes] = await Promise.all([
        api.get('/transactions', { params: transactionsParams }).catch(() => ({ data: [] })),
        api.get('/accounts').catch(() => ({ data: [] })),
        api.get('/categories').catch(() => ({ data: [] })),
        api.get('/cards').catch(() => ({ data: [] })),
      ]);

      const transList = extractList(transRes.data);
      const accList = extractList(accRes.data);
      const catList = extractList(catRes.data);
      const transMeta = extractMeta(transRes.data);

      setTransactions(transList);
      setAccounts(accList);
      setCategories(catList);
      setCards(extractList(cardRes.data));
      setTotalPages(transMeta?.totalPages ?? 1);
      setTotal(transMeta?.total ?? transList.length);

      if (accList.length > 0 && !accountId && !editingId) {
        setAccountId(defaultAccount<AccountOption>(accList).id);
      }
    } catch (err) {
      console.error('Erro geral ao carregar dados:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate, categoryFilter, typeFilters, descriptionFilter, amountFilter, page]);

  // Gera (de forma idempotente) o lançamento pendente do mês corrente pra
  // cada conta fixa ativa, assim que a tela é aberta.
  useEffect(() => {
    api.post('/recurring-bills/sync').then(() => fetchData()).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleOpenCreate = () => {
    setEditingId(null);
    setEditingTransferId(null);
    setDescription('');
    setAmount('');
    setUiType('EXPENSE');
    setStatus('PAID');
    setCategoryId('');
    setCategoryAutoSuggested(false);
    setDestinationAccountId('');
    setCardId('');
    setInstallmentsCount(1);
    setDate(todayLocalISO());
    if (accounts.length > 0) setAccountId(defaultAccount(accounts).id);
    setIsModalOpen(true);
  };

  // /transactions?new=1 (botão "+" da navegação do celular) já abre o formulário;
  // o parâmetro sai da URL em seguida pra um F5 não reabrir.
  useEffect(() => {
    if (searchParams.get('new') !== '1') return;
    handleOpenCreate();
    router.replace('/transactions', { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const handleEdit = (t: Transaction) => {
    if (t.type === 'TRANSFER') {
      if (!t.transfer?.id) {
        notifyAlert(
          'Esta movimentação foi criada antes da atualização do sistema e não guarda o vínculo ' +
          'necessário para edição. Você pode excluí-la e lançar novamente.'
        );
        return;
      }
      setEditingId(t.id);
      setEditingTransferId(t.transfer.id);
      setUiType(t.transfer.toAccount?.type === 'INVESTMENT' ? 'INVESTMENT' : 'TRANSFER');
      setDescription(t.description);
      setAmount(t.amount.toString());
      setStatus('PAID');
      setDate(new Date(t.date).toISOString().split('T')[0]);
      if (t.accountId) setAccountId(t.accountId);
      setDestinationAccountId(t.transfer.toId);
      setCategoryId('');
      setCategoryAutoSuggested(false);
      setIsModalOpen(true);
      return;
    }

    setEditingId(t.id);
    setEditingTransferId(null);
    setDescription(t.description);
    setAmount(t.amount.toString());
    setUiType(t.type);
    setStatus(t.status as any);
    setDate(new Date(t.date).toISOString().split('T')[0]);
    if (t.accountId) setAccountId(t.accountId);
    setCategoryId(t.categoryId || '');
    setCategoryAutoSuggested(false);
    setIsModalOpen(true);
  };

  const handleDelete = async (t: Transaction): Promise<boolean> => {
    if (!(await confirmDialog(`Tem certeza que deseja excluir a transação "${t.description}"?`))) return false;
    try {
      if (t.type === 'TRANSFER') {
        if (!t.transfer?.id) {
          notifyAlert(
            'Esta movimentação foi criada antes da atualização do sistema e não guarda o vínculo ' +
            'necessário para exclusão automática do saldo. Ajuste o saldo manualmente se precisar removê-la.'
          );
          return false;
        }
        await api.delete(`/accounts/transfer/${t.transfer.id}`);
      } else {
        await api.delete(`/transactions/${t.id}`);
      }
      fetchData();
      return true;
    } catch (err: any) {
      // O backend explica quando a exclusão precisa ser feita em outro lugar (ex: compra no cartão).
      const backendMessage = err?.response?.data?.message;
      notifyAlert(typeof backendMessage === 'string' ? backendMessage : 'Erro ao excluir transação.');
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const parsedAmount = parseFloat(amount);

    // Compra no cartão: vira compra (parcelada ou à vista) na fatura do cartão
    if (usingCard) {
      if (description.trim().length < 2) {
        notifyAlert('Descreva a compra (ex: Mercado).');
        return;
      }
      setIsSubmitting(true);
      try {
        await api.post(`/cards/${cardId}/purchases`, {
          description: description.trim(),
          totalAmount: parsedAmount,
          installmentsCount,
          purchaseDate: date,
          categoryId: categoryId || undefined,
        });
        setIsModalOpen(false);
        fetchData();
      } catch (err: any) {
        const msg = err.response?.data?.message;
        notifyAlert(Array.isArray(msg) ? msg.join('\n') : msg || 'Erro ao lançar a compra no cartão.');
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    if (!accountId) {
      notifyAlert('Selecione a conta de origem.');
      return;
    }

    setIsSubmitting(true);

    try {
      const isoDate = new Date(`${date}T12:00:00.000Z`).toISOString();

      if (uiType === 'TRANSFER' || uiType === 'INVESTMENT') {
        if (!destinationAccountId) {
          notifyAlert('Selecione a conta de destino.');
          setIsSubmitting(false);
          return;
        }
        if (accountId === destinationAccountId) {
          notifyAlert('A conta de origem e destino não podem ser a mesma.');
          setIsSubmitting(false);
          return;
        }

        const transferPayload = {
          fromAccountId: accountId,
          toAccountId: destinationAccountId,
          amount: parsedAmount,
          description: description || (uiType === 'INVESTMENT' ? 'Aporte de Investimento' : 'Transferência entre contas'),
        };

        if (editingTransferId) {
          await api.patch(`/accounts/transfer/${editingTransferId}`, { ...transferPayload, date: isoDate });
        } else {
          await api.post('/accounts/transfer', transferPayload);
        }
      } else {
        const payload = {
          description,
          amount: parsedAmount,
          type: uiType,
          accountId,
          categoryId: categoryId || undefined,
          status,
          date: isoDate,
        };

        if (editingId) {
          await api.patch(`/transactions/${editingId}`, payload);
        } else {
          await api.post('/transactions', payload);
        }
      }

      setIsModalOpen(false);
      setEditingId(null);
      setEditingTransferId(null);
      fetchData();
    } catch (err: any) {
      const backendMessage = err.response?.data?.message;
      const formattedError = Array.isArray(backendMessage)
        ? backendMessage.join('\n• ')
        : backendMessage || err.message || 'Erro desconhecido ao salvar transação';
      
      notifyAlert(`Erro crítico:\n• ${formattedError}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const investmentAccounts = accounts.filter(acc => acc.type === 'INVESTMENT');
  const selectedAccount = accounts.find((acc) => acc.id === accountId);
  const isTransferForm = uiType === 'TRANSFER' || uiType === 'INVESTMENT';
  const editingTx = editingId ? transactions.find((t) => t.id === editingId) : undefined;
  // Cartão só vale pra saída nova (editar compra de cartão é pela fatura)
  const usingCard = uiType === 'EXPENSE' && !editingId && !!cardId;
  const selectedCard = cards.find((c) => c.id === cardId);
  const cardAvailable = selectedCard ? Number(selectedCard.limitAmount) - Number(selectedCard.usedLimit) : 0;
  const parsedFormAmount = parseFloat(amount) || 0;
  // Contas do dia a dia primeiro; as de investimento vão pro fim da fila
  // Saída/entrada: só contas do dia a dia (investimento ficaria fora das
  // despesas/receitas do mês). Na edição, mantém a conta atual mesmo que seja
  // de investimento. Transferência mostra todas (resgate sai do investimento).
  const sourceOptions = isTransferForm
    ? [...accounts].sort((a, b) => Number(a.type === 'INVESTMENT') - Number(b.type === 'INVESTMENT'))
    : accounts.filter((acc) => acc.type !== 'INVESTMENT' || (!!editingId && acc.id === accountId));
  const destinationOptions = (uiType === 'INVESTMENT' ? investmentAccounts : accounts).filter((acc) => acc.id !== accountId);

  const activePeriod = PERIOD_PRESETS.find((p) => {
    const r = p.range();
    return r.start === startDate && r.end === endDate;
  })?.key;
  const showCustomPeriod = customPeriodOpen || !activePeriod;
  const hasSearch = !!(descriptionInput || amountInput);
  const filtersActive = hasSearch || typeFilters.length > 0 || !!categoryFilter;

  // Agrupa a página atual por dia (a lista já vem ordenada do backend)
  const dayGroups: { key: string; label: string; items: Transaction[] }[] = [];
  transactions.forEach((t) => {
    const key = new Date(effectiveDate(t)).toDateString();
    const last = dayGroups[dayGroups.length - 1];
    if (last && last.key === key) last.items.push(t);
    else dayGroups.push({ key, label: dayLabel(effectiveDate(t)), items: [t] });
  });

  return (
    <div>
      <div className="mb-5 flex items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-display text-[1.7rem] font-bold leading-tight tracking-tight sm:text-3xl">Transações</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {loading && transactions.length === 0
              ? 'Carregando…'
              : `${total} ${total === 1 ? 'lançamento' : 'lançamentos'}${filtersActive ? ' com os filtros atuais' : ''}`}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Link
            href="/import"
            className="inline-flex h-10 items-center gap-2 rounded-full bg-foreground/[0.05] px-4 text-sm font-semibold text-muted-foreground transition-theme hover:bg-foreground/[0.08] hover:text-foreground active:scale-[0.97]"
          >
            <Upload className="h-4 w-4" strokeWidth={1.9} />
            <span>Importar<span className="hidden sm:inline"> extrato</span></span>
          </Link>
          <Button
            className="hidden lg:inline-flex"
            onClick={() => {
              fetchData();
              handleOpenCreate();
            }}
          >
            <Plus className="h-4 w-4" strokeWidth={2.2} />
            Novo lançamento
          </Button>
        </div>
      </div>

      {/* Filtros: busca em destaque, período e tipo em chips. Datas exatas e
          valor só aparecem quando pedidos — sem a fileira de campos de antes. */}
      <div className="mb-4 flex flex-col gap-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative lg:w-80 lg:shrink-0">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              aria-label="Buscar por descrição"
              placeholder="Buscar por descrição"
              value={descriptionInput}
              onChange={(e) => setDescriptionInput(e.target.value)}
              className="h-10 w-full rounded-full border border-transparent bg-foreground/[0.05] pl-10 pr-4 text-sm transition-theme placeholder:text-muted-foreground/80 hover:bg-foreground/[0.07] focus-visible:border-primary focus-visible:bg-card focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/15"
            />
          </div>
          <div className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0" role="group" aria-label="Período">
            {PERIOD_PRESETS.map((p) => (
              <Chip
                key={p.key}
                active={!showCustomPeriod && activePeriod === p.key}
                onClick={() => {
                  const r = p.range();
                  setStartDate(r.start);
                  setEndDate(r.end);
                  setCustomPeriodOpen(false);
                  setPage(1);
                }}
              >
                {p.label}
              </Chip>
            ))}
            <Chip active={showCustomPeriod} onClick={() => setCustomPeriodOpen(true)}>
              <CalendarRange className="h-3.5 w-3.5" strokeWidth={1.9} />
              Personalizado
            </Chip>
          </div>
        </div>

        <div className="scrollbar-none -mx-4 flex items-center gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
          <div className="flex gap-2" role="group" aria-label="Tipo">
            {TYPE_FILTER_OPTIONS.map((o) => (
              <Chip key={o.value} active={typeFilters.includes(o.value)} onClick={() => toggleTypeFilter(o.value)}>
                {o.label}
              </Chip>
            ))}
          </div>
          <span className="mx-1 hidden h-5 w-px shrink-0 bg-border sm:block" aria-hidden />
          <Chip active={amountOpen || !!amountInput} onClick={() => setAmountOpen((o) => !o)}>
            <SlidersHorizontal className="h-3.5 w-3.5" strokeWidth={1.9} />
            Valor exato
          </Chip>
          {categoryFilter && (
            <Chip active onClick={() => { setCategoryFilter(''); setPage(1); }} title="Remover filtro de categoria">
              {categories.find((c) => c.id === categoryFilter)?.name ?? 'Categoria'}
              <X className="h-3.5 w-3.5" />
            </Chip>
          )}
          {(typeFilters.length > 0 || hasSearch) && (
            <button
              type="button"
              onClick={() => { setTypeFilters([]); setDescriptionInput(''); setAmountInput(''); setAmountOpen(false); setPage(1); }}
              className="shrink-0 px-2 text-[13px] font-semibold text-primary hover:underline"
            >
              Limpar
            </button>
          )}
        </div>

        {(showCustomPeriod || amountOpen || !!amountInput) && (
          <div className="flex animate-fade-in flex-wrap items-end gap-3 rounded-2xl bg-foreground/[0.03] p-3">
            {showCustomPeriod && (
              <>
                <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                  De
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
                    className={fieldClass}
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                  Até
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
                    className={fieldClass}
                  />
                </label>
              </>
            )}
            {(amountOpen || !!amountInput) && (
              <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                Valor (R$)
                <input
                  type="number"
                  step="0.01"
                  inputMode="decimal"
                  placeholder="Ex: 100,00"
                  value={amountInput}
                  onChange={(e) => setAmountInput(e.target.value)}
                  className={`${fieldClass} w-36`}
                />
              </label>
            )}
          </div>
        )}
      </div>

      {loading && transactions.length === 0 ? (
        <div className="flex flex-col gap-2" aria-busy="true" aria-label="Carregando transações">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-2 py-3">
              <Skeleton className="h-10 w-10 rounded-xl" />
              <div className="flex-1">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="mt-2 h-3 w-24" />
              </div>
              <Skeleton className="h-5 w-24" />
            </div>
          ))}
        </div>
      ) : transactions.length === 0 ? (
        <EmptyState
          icon={ArrowLeftRight}
          title={filtersActive ? 'Nada encontrado' : 'Nenhum lançamento neste período'}
          description={
            filtersActive
              ? 'Ajuste a busca ou os filtros para ver outros lançamentos.'
              : 'Lance uma entrada ou saída, ou troque o período acima.'
          }
          action={<Button onClick={handleOpenCreate}><Plus className="h-4 w-4" strokeWidth={2.2} />Novo lançamento</Button>}
        />
      ) : (
        <div className={`flex flex-col gap-3 transition-opacity ${loading ? 'opacity-60' : ''}`}>
          {dayGroups.map((group) => (
            <section key={group.key}>
              <h2 className="mb-1 flex items-center gap-3 px-2 text-xs font-semibold text-muted-foreground">
                <span className="first-letter:uppercase">{group.label}</span>
                <span className="hairline flex-1" aria-hidden />
              </h2>
              <ul>
                {group.items.map((t) => {
                  const isIncome = t.type === 'INCOME';
                  // Investimento não é um TransactionType próprio — é uma TRANSFER cuja
                  // conta de destino é do tipo INVESTMENT (mesma regra usada no backend
                  // e no filtro de tipo).
                  const isInvestment = t.type === 'TRANSFER' && t.transfer?.toAccount?.type === 'INVESTMENT';
                  const isTransfer = t.type === 'TRANSFER' && !isInvestment;
                  const paid = isEffectivelyPaid(t);
                  const source = installmentSource(t);
                  const acc = accounts.find((a) => a.id === t.accountId);
                  const KindIcon = isIncome ? ArrowDownLeft : isInvestment ? TrendingUp : isTransfer ? ArrowLeftRight : ArrowUpRight;
                  const kindLabel = isIncome ? 'Entrada' : isInvestment ? 'Investimento' : isTransfer ? 'Transferência' : 'Saída';

                  const body = (
                    <>
                      <span
                        title={kindLabel}
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                          isIncome ? 'bg-success/10 text-success'
                          : isInvestment ? 'bg-primary/10 text-primary'
                          : isTransfer ? 'bg-warning/10 text-warning'
                          : 'bg-foreground/[0.06] text-muted-foreground'
                        }`}
                      >
                        <KindIcon className="h-[18px] w-[18px]" strokeWidth={1.9} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">{t.description}</span>
                        <span className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                          {isTransfer || isInvestment ? (
                            <span className="truncate">{t.account?.name || '—'} → {t.transfer?.toAccount?.name || '—'}</span>
                          ) : (
                            <>
                              {acc && <AccountAvatar name={acc.name} color={acc.color} icon={acc.icon} className="h-4 w-4 rounded-[5px] text-[9px]" />}
                              <span className="truncate">{t.account?.name || '-'}</span>
                            </>
                          )}
                          {t.category && (
                            <>
                              <span aria-hidden>·</span>
                              <span className="flex min-w-0 items-center gap-1">
                                <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: t.category.color }} />
                                <span className="truncate">{t.category.name}</span>
                              </span>
                            </>
                          )}
                          {!paid && (
                            <>
                              <span aria-hidden>·</span>
                              <span className="shrink-0 font-semibold text-warning">Pendente</span>
                            </>
                          )}
                        </span>
                      </span>
                      <span className={`font-num shrink-0 text-[15px] font-semibold ${isIncome ? 'text-success' : ''} ${!paid ? 'opacity-70' : ''}`}>
                        {isIncome ? '+ ' : isTransfer || isInvestment ? '' : '− '}
                        {formatCurrency(t.amount)}
                      </span>
                    </>
                  );

                  const rowMain = 'flex min-w-0 flex-1 items-center gap-3 rounded-xl px-2 py-2.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary';

                  return (
                    <li key={t.id} className="group flex items-center gap-1 rounded-xl transition-colors hover:bg-foreground/[0.035]">
                      {source ? (
                        <Link href={source.href} title={source.label} className={rowMain}>{body}</Link>
                      ) : (
                        <button type="button" onClick={() => handleEdit(t)} title="Editar" className={rowMain}>{body}</button>
                      )}
                      {source ? (
                        <Link
                          href={source.href}
                          aria-label={source.label}
                          title={source.label}
                          className="mr-1 hidden h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground opacity-0 transition-theme hover:bg-primary/10 hover:text-primary focus-visible:opacity-100 group-hover:opacity-100 [@media(hover:hover)]:flex"
                        >
                          <ExternalLink className="h-4 w-4" strokeWidth={1.9} />
                        </Link>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleDelete(t)}
                          aria-label={`Excluir ${t.description}`}
                          title="Excluir"
                          className="mr-1 hidden h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground opacity-0 transition-theme hover:bg-danger/10 hover:text-danger focus-visible:opacity-100 group-hover:opacity-100 [@media(hover:hover)]:flex"
                        >
                          <Trash2 className="h-4 w-4" strokeWidth={1.9} />
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}

      {transactions.length > 0 && totalPages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-3">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            aria-label="Página anterior"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-foreground/[0.05] text-muted-foreground transition-theme hover:bg-foreground/[0.08] hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <p className="font-num text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">{page}</span> de {totalPages}
          </p>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            aria-label="Próxima página"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-foreground/[0.05] text-muted-foreground transition-theme hover:bg-foreground/[0.08] hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}

      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-[2px] sm:items-center sm:p-4"
          onMouseDown={(e) => { if (e.target === e.currentTarget) setIsModalOpen(false); }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={editingId ? 'Editar lançamento' : 'Novo lançamento'}
            className="flex max-h-[94dvh] w-full max-w-lg animate-rise flex-col overflow-hidden rounded-t-[1.75rem] border border-border bg-card text-card-foreground shadow-xl sm:max-h-[90vh] sm:rounded-[1.75rem]"
          >
            <div className="flex items-center justify-between gap-4 px-5 pt-4">
              <h2 className="font-display text-lg font-bold tracking-tight">
                {editingId ? 'Editar lançamento' : 'Novo lançamento'}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-theme hover:bg-foreground/[0.06] hover:text-foreground"
                aria-label="Fechar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
              <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-5 pb-5 pt-3 [scrollbar-width:thin]">
                {!editingId && (
                  <Segmented
                    aria-label="Tipo de lançamento"
                    value={uiType === 'INVESTMENT' ? 'TRANSFER' : uiType}
                    onChange={(v) => {
                      setUiType(v);
                      // Voltando de transferência com conta de investimento marcada: troca
                      // pra uma conta do dia a dia (a de investimento some da lista).
                      if (v !== 'TRANSFER' && accounts.find((a) => a.id === accountId)?.type === 'INVESTMENT') {
                        const daily = accounts.find((a) => a.type !== 'INVESTMENT');
                        if (daily) setAccountId(daily.id);
                      }
                    }}
                    options={TYPE_OPTIONS}
                    className="w-full"
                  />
                )}

                {/* O valor é o protagonista: grande, no centro, sem moldura */}
                <div className="flex flex-col items-center gap-1 py-1">
                  <label htmlFor="tx-amount" className="text-xs font-medium text-muted-foreground">{TYPE_HELP[uiType]}</label>
                  <div
                    className={`flex items-baseline justify-center gap-2 border-b-2 border-transparent pb-1 transition-colors focus-within:border-primary/50 ${
                      uiType === 'INCOME' ? 'text-success' : uiType === 'EXPENSE' ? 'text-foreground' : 'text-warning'
                    }`}
                  >
                    <span className="font-num text-xl font-semibold text-muted-foreground">R$</span>
                    <input
                      id="tx-amount"
                      type="number"
                      step="0.01"
                      min="0"
                      inputMode="decimal"
                      required
                      autoFocus={!editingId}
                      placeholder="0,00"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      style={{ width: `${Math.max(4, amount.length + 1)}ch` }}
                      className="font-num max-w-[11ch] bg-transparent text-center text-[2.75rem] font-bold leading-none tracking-tight outline-none placeholder:text-muted-foreground/40 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    />
                  </div>
                </div>

                <Input
                  type="text"
                  aria-label="Descrição"
                  placeholder={isTransferForm ? 'Descrição (opcional)' : uiType === 'INCOME' ? 'De onde veio? Ex: Salário' : 'Com o quê? Ex: Mercado'}
                  value={description}
                  onChange={(e) => handleDescriptionChange(e.target.value)}
                />

                <FormRow
                  label={isTransferForm ? 'Sai de' : uiType === 'INCOME' ? 'Entra na conta' : 'Pago com'}
                  hint={
                    usingCard
                      ? `Limite disponível ${formatCurrency(cardAvailable)}`
                      : selectedAccount?.currentBalance !== undefined
                        ? `Saldo ${formatCurrency(Number(selectedAccount.currentBalance))}`
                        : undefined
                  }
                >
                  {accounts.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Cadastre uma conta em Contas para lançar.</p>
                  ) : (
                    sourceOptions.map((acc) => (
                      <Chip
                        key={acc.id}
                        active={!usingCard && accountId === acc.id}
                        onClick={() => { setAccountId(acc.id); setCardId(''); }}
                        className="pl-1.5"
                      >
                        <AccountAvatar name={acc.name} color={acc.color} icon={acc.icon} className="h-6 w-6 rounded-full text-[10px]" />
                        {acc.name}
                      </Chip>
                    ))
                  )}
                  {uiType === 'EXPENSE' && !editingId && cards.length > 0 && (
                    <>
                      <span className="mt-1 basis-full text-[11px] font-semibold text-muted-foreground/80">Cartão de crédito</span>
                      {cards.map((c) => (
                        <Chip key={c.id} active={cardId === c.id} onClick={() => setCardId(c.id)} className="pl-2">
                          <CreditCard className="h-4 w-4" strokeWidth={1.9} style={{ color: c.color || undefined }} />
                          {c.name}
                        </Chip>
                      ))}
                    </>
                  )}
                </FormRow>

                {usingCard && (
                  <FormRow
                    label="Parcelas"
                    hint={installmentsCount > 1 && parsedFormAmount > 0 ? `${installmentsCount}x de ${formatCurrency(parsedFormAmount / installmentsCount)}` : 'À vista na próxima fatura'}
                  >
                    {INSTALLMENT_CHOICES.map((n) => (
                      <Chip key={n} active={installmentsCount === n} onClick={() => setInstallmentsCount(n)}>
                        {n === 1 ? 'À vista' : `${n}x`}
                      </Chip>
                    ))}
                    <input
                      type="number"
                      min={1}
                      max={48}
                      aria-label="Outro número de parcelas"
                      placeholder="Outro"
                      value={INSTALLMENT_CHOICES.includes(installmentsCount) ? '' : installmentsCount}
                      onChange={(e) => setInstallmentsCount(Math.min(48, Math.max(1, parseInt(e.target.value, 10) || 1)))}
                      className="h-9 w-20 rounded-full border border-border/80 bg-transparent px-3 text-[13px] focus-visible:border-primary focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/15"
                    />
                  </FormRow>
                )}

                {isTransferForm && (
                  <FormRow label="Vai para">
                    {destinationOptions.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        {uiType === 'INVESTMENT' ? 'Crie uma conta de Investimento para receber o aporte.' : 'Você precisa de outra conta para transferir.'}
                      </p>
                    ) : (
                      destinationOptions.map((acc) => (
                        <Chip key={acc.id} active={destinationAccountId === acc.id} onClick={() => setDestinationAccountId(acc.id)} className="pl-1.5">
                          <AccountAvatar name={acc.name} color={acc.color} icon={acc.icon} className="h-6 w-6 rounded-full text-[10px]" />
                          {acc.name}
                        </Chip>
                      ))
                    )}
                  </FormRow>
                )}

                {!isTransferForm && (
                  <FormRow
                    label="Categoria"
                    hint={categoryAutoSuggested && categoryId ? 'Sugerida pela descrição' : undefined}
                    hintTone="primary"
                  >
                    {categories.length === 0 ? (
                      <p className="text-xs text-warning">
                        Nenhuma categoria encontrada. Saia e entre novamente na sua conta para criar as categorias padrão.
                      </p>
                    ) : (
                      categories.map((cat) => (
                        <Chip
                          key={cat.id}
                          active={categoryId === cat.id}
                          onClick={() => handleCategoryChange(categoryId === cat.id ? '' : cat.id)}
                        >
                          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: cat.color }} />
                          {cat.name}
                        </Chip>
                      ))
                    )}
                  </FormRow>
                )}

                <FormRow label="Quando">
                  {QUICK_DATES.map((q) => (
                    <Chip key={q.label} active={date === q.value()} onClick={() => setDate(q.value())}>
                      {q.label}
                    </Chip>
                  ))}
                  <input
                    type="date"
                    required
                    aria-label="Data"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className={`h-9 rounded-full border px-3 text-[13px] font-medium transition-theme focus-visible:border-primary focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/15 ${
                      QUICK_DATES.some((q) => q.value() === date)
                        ? 'border-border/80 bg-transparent text-muted-foreground'
                        : 'border-primary/40 bg-primary/10 text-primary'
                    }`}
                  />
                </FormRow>

                {!isTransferForm && !usingCard && (
                  <FormRow label="Situação">
                    <Segmented
                      size="sm"
                      aria-label="Situação"
                      value={status}
                      onChange={(v) => setStatus(v)}
                      options={[
                        { value: 'PAID', label: uiType === 'INCOME' ? 'Recebido' : 'Pago' },
                        { value: 'PENDING', label: 'Pendente' },
                      ]}
                    />
                  </FormRow>
                )}
              </div>

              <div className="flex gap-3 border-t border-border/60 px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                {editingTx && (
                  <button
                    type="button"
                    onClick={async () => { if (await handleDelete(editingTx)) setIsModalOpen(false); }}
                    aria-label="Excluir lançamento"
                    title="Excluir lançamento"
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-theme hover:bg-danger/10 hover:text-danger"
                  >
                    <Trash2 className="h-[18px] w-[18px]" strokeWidth={1.9} />
                  </button>
                )}
                <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" isLoading={isSubmitting} className="flex-1">
                  {editingId ? 'Salvar alterações' : uiType === 'TRANSFER' ? 'Transferir' : usingCard ? 'Lançar no cartão' : 'Lançar'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function TransactionsPage() {
  return (
    <Suspense fallback={null}>
      <TransactionsPageContent />
    </Suspense>
  );
}