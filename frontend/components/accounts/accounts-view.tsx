'use client';

import { ImagePlus, Landmark, X } from 'lucide-react';
import { AccountAvatar } from '@/components/accounts/account-avatar';
import { fileToLogoDataUrl, isImageIcon } from '@/utils/image-resize';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { notifyAlert, confirmDialog } from '@/utils/notify';
import React, { useEffect, useState } from 'react';
import { api } from '@/services/api';
import { formatCurrency } from '@/utils/currency';

interface Account {
  id: string;
  name: string;
  type: string;
  initialBalance?: number | string;
  currentBalance?: number | string;
  color?: string;
  icon?: string;
  includeInDashboard: boolean;
}

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  CHECKING: 'Conta Corrente',
  SAVINGS: 'Poupança',
  WALLET: 'Carteira',
  CASH: 'Dinheiro Espécie',
  INVESTMENT: 'Investimento',
};

export function AccountsView() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [type, setType] = useState('CHECKING');
  const [initialBalance, setInitialBalance] = useState('');
  const [color, setColor] = useState('#3b82f6');
  // logo: undefined = sem mudança | string = nova imagem | null = remover
  const [logo, setLogo] = useState<string | null | undefined>(undefined);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [currentIcon, setCurrentIcon] = useState<string | undefined>(undefined);
  const [includeInDashboard, setIncludeInDashboard] = useState(true);

  const extractList = (rawResponse: any): Account[] => {
    if (!rawResponse) return [];
    if (Array.isArray(rawResponse)) return rawResponse;
    if (Array.isArray(rawResponse.data)) return rawResponse.data;
    if (Array.isArray(rawResponse.items)) return rawResponse.items;
    if (Array.isArray(rawResponse.data?.items)) return rawResponse.data.items;
    return [];
  };

  const fetchAccounts = async () => {
    try {
      const response = await api.get('/accounts');
      const list = extractList(response.data);
      setAccounts(list);
    } catch (err: any) {
      console.error('Erro ao buscar contas:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAccounts(); }, []);

  const handleOpenCreate = () => {
    setLogo(undefined);
    setLogoError(null);
    setCurrentIcon(undefined);
    setEditingId(null);
    setName('');
    setType('CHECKING');
    setInitialBalance('');
    setColor('#3b82f6');
    setIncludeInDashboard(true);
    setIsModalOpen(true);
  };

  const handleEdit = (acc: Account) => {
    setEditingId(acc.id);
    setName(acc.name);
    setType(acc.type);
    // No modo edição este campo representa o saldo ATUAL (não o inicial da
    // criação) — é o que aparece na aba Contas e no Saldo Geral.
    setInitialBalance((acc.currentBalance ?? acc.initialBalance)?.toString() || '0');
    setColor(acc.color || '#3b82f6');
    setLogo(undefined);
    setLogoError(null);
    setCurrentIcon(acc.icon);
    setIncludeInDashboard(acc.includeInDashboard ?? true);
    setIsModalOpen(true);
  };

  // ITEM 6 — Toggle rápido de "controle de saldo" direto no card, sem abrir modal
  const handleToggleDashboard = async (acc: Account) => {
    const newValue = !acc.includeInDashboard;
    // Atualiza otimisticamente na UI
    setAccounts((prev) =>
      prev.map((a) => (a.id === acc.id ? { ...a, includeInDashboard: newValue } : a))
    );
    try {
      await api.patch(`/accounts/${acc.id}`, { includeInDashboard: newValue });
    } catch (err) {
      // Reverte se der erro
      setAccounts((prev) =>
        prev.map((a) => (a.id === acc.id ? { ...a, includeInDashboard: !newValue } : a))
      );
      notifyAlert('Erro ao atualizar preferência da conta.');
    }
  };

  const handleArchive = async (id: string, accountName: string) => {
    if (!(await confirmDialog(`Tem certeza que deseja remover a conta "${accountName}"?`))) return;
    try {
      await api.delete(`/accounts/${id}`);
      fetchAccounts();
    } catch {
      notifyAlert('Erro ao arquivar a conta.');
    }
  };


  const handleLogoFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setLogoError(null);
    try {
      setLogo(await fileToLogoDataUrl(file));
    } catch (err: any) {
      setLogoError(err?.message ?? 'Não foi possível usar essa imagem.');
    }
  };

  const previewIcon = logo !== undefined ? logo : currentIcon;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const balanceValue = parseFloat(initialBalance || '0');
      const payload = editingId
        ? {
            name,
            type,
            // Correção direta do saldo atual — initialBalance não muda aqui,
            // ele só faz sentido no momento da criação da conta.
            currentBalance: balanceValue,
            color: color || '#3b82f6',
            includeInDashboard,
            ...(logo !== undefined ? { icon: logo } : {}),
          }
        : {
            name,
            type,
            initialBalance: balanceValue,
            color: color || '#3b82f6',
            includeInDashboard, // ITEM 1 — enviado ao backend
            ...(logo ? { icon: logo } : {}),
          };

      if (editingId) {
        await api.patch(`/accounts/${editingId}`, payload);
      } else {
        await api.post('/accounts', payload);
      }

      setIsModalOpen(false);
      setEditingId(null);
      await fetchAccounts();
    } catch (err: any) {
      const backendMessage = err.response?.data?.message;
      const formattedError = Array.isArray(backendMessage)
        ? backendMessage.join('\n• ')
        : backendMessage || 'Erro ao salvar conta';
      notifyAlert(`Erro no servidor:\n• ${formattedError}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalBalance = accounts
    .filter((a) => a.includeInDashboard)
    .reduce((sum, a) => sum + Number(a.currentBalance ?? a.initialBalance ?? 0), 0);

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Saldo total</p>
          <p className={`font-num mt-1 text-4xl font-bold leading-none ${totalBalance < 0 ? 'text-danger' : ''}`}>
            {formatCurrency(totalBalance)}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Soma das contas marcadas com Controle de Saldo
          </p>
        </div>
        <button
          onClick={handleOpenCreate}
          className="bg-primary hover:brightness-110 hover:-translate-y-px active:scale-[0.97] btn-sheen text-primary-foreground px-4 py-2 rounded-md font-medium transition shadow"
        >
          + Nova Conta
        </button>
      </div>

      {/* Legenda */}
      <div className="mb-4 flex items-start gap-2 text-xs text-muted-foreground">
        <span className="mt-0.5 inline-block h-3 w-3 shrink-0 rounded-full bg-primary"></span>
        <span>
          Contas marcadas com <strong className="text-foreground">Controle de Saldo</strong> entram no{' '}
          <strong className="text-foreground">Saldo Geral</strong> do Dashboard
        </span>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-xl" />
          ))}
        </div>
      ) : accounts.length === 0 ? (
        <EmptyState
          className="rounded-xl border border-dashed border-border"
          icon={Landmark}
          title="Nenhuma conta ainda"
          description="Cadastre sua primeira conta, carteira ou instituição para começar a acompanhar saldos."
          action={
            <button
              onClick={handleOpenCreate}
              className="h-10 rounded-md bg-primary px-5 text-sm font-semibold text-primary-foreground transition-theme hover:brightness-110 active:scale-[0.97]"
            >
              + Nova Conta
            </button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {accounts.map((acc) => (
            <div
              key={acc.id}
              className="bg-card p-6 rounded-xl shadow border border-border relative overflow-hidden group"
            >
              {/* Barra de cor no topo */}
              <div
                className="absolute top-0 left-0 right-0 h-1"
                style={{ backgroundColor: acc.color || '#3b82f6' }}
              />

              {/* Botões Editar / Excluir (hover) */}
              <div className="absolute top-4 right-4 flex gap-3 [@media(hover:hover)]:opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => handleEdit(acc)}
                  className="text-foreground hover:text-primary text-sm font-medium"
                >
                  Editar
                </button>
                <button
                  onClick={() => handleArchive(acc.id, acc.name)}
                  className="text-foreground hover:text-danger text-sm font-medium"
                >
                  Excluir
                </button>
              </div>

              <div className="flex items-center gap-3">
                <AccountAvatar name={acc.name} color={acc.color} icon={acc.icon} className="h-12 w-12" />
                <div className="min-w-0">
                  <span className="text-xs uppercase font-bold tracking-wider text-primary bg-primary/10 px-2 py-1 rounded">
                    {ACCOUNT_TYPE_LABELS[acc.type] ?? acc.type}
                  </span>
                  <h3 className="mt-1.5 truncate text-xl font-bold">{acc.name}</h3>
                </div>
              </div>
              <p
                className={`text-2xl font-semibold mt-2 ${
                  Number(acc.currentBalance ?? acc.initialBalance ?? 0) < 0
                    ? 'text-danger'
                    : 'text-success'
                }`}
              >
                {formatCurrency(acc.currentBalance ?? acc.initialBalance)}
              </p>

              {/* ITEM 6 — Botão toggle "Utilizar para controle de saldo" */}
              <button
                onClick={() => handleToggleDashboard(acc)}
                title={
                  acc.includeInDashboard
                    ? 'Clique para remover do Saldo Geral'
                    : 'Clique para incluir no Saldo Geral'
                }
                className={`mt-4 flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-full border transition-all ${
                  acc.includeInDashboard
                    ? 'bg-primary/10 border-primary/30 text-primary'
                    : 'bg-muted border-input text-foreground'
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    acc.includeInDashboard ? 'bg-primary' : 'bg-muted'
                  }`}
                />
                {acc.includeInDashboard ? 'No controle de saldo' : 'Fora do saldo geral'}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Modal Criar / Editar */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-[2px] flex items-end justify-center z-50 sm:items-center sm:p-4">
        <div className="bg-card rounded-t-2xl sm:rounded-xl shadow-xl w-full max-w-md p-6 border border-border animate-rise max-h-[92dvh] overflow-y-auto sm:max-h-[90vh]">
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-xl font-bold">
                {editingId ? 'Editar Conta' : 'Nova Conta Bancária'}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-foreground hover:text-foreground/80 font-bold text-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Nome da Conta</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Itaú, Nubank, Carteira..."
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 border border-input rounded-lg bg-transparent focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Tipo de Conta</label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  className="w-full px-3 py-2 border border-input rounded-lg bg-card focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="CHECKING">Conta Corrente</option>
                  <option value="SAVINGS">Poupança</option>
                  <option value="WALLET">Carteira</option>
                  <option value="CASH">Dinheiro Espécie</option>
                  <option value="INVESTMENT">Investimento</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  {editingId ? 'Saldo Atual (R$)' : 'Saldo Inicial (R$)'}
                </label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="0,00"
                  value={initialBalance}
                  onChange={(e) => setInitialBalance(e.target.value)}
                  className="w-full px-3 py-2 border border-input rounded-lg bg-transparent focus:outline-none focus:ring-2 focus:ring-primary"
                />
                {editingId && (
                  <p className="text-xs text-foreground mt-1">
                    Corrige o saldo desta conta diretamente — use se o valor mostrado estiver divergente do real.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Logo (opcional)</label>
                <div className="flex items-center gap-3">
                  <AccountAvatar name={name || 'Conta'} color={color} icon={previewIcon} className="h-14 w-14" />
                  <div className="flex flex-wrap gap-2">
                    <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border border-input bg-card px-3 text-sm font-semibold transition-theme hover:bg-muted active:scale-[0.97]">
                      <ImagePlus className="h-4 w-4" strokeWidth={1.75} />
                      {isImageIcon(previewIcon) ? 'Trocar imagem' : 'Escolher imagem'}
                      <input type="file" accept="image/*" className="sr-only" onChange={handleLogoFile} />
                    </label>
                    {isImageIcon(previewIcon) && (
                      <button
                        type="button"
                        onClick={() => setLogo(null)}
                        className="inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-sm font-semibold text-muted-foreground transition-theme hover:bg-muted hover:text-danger active:scale-[0.97]"
                      >
                        <X className="h-4 w-4" /> Remover
                      </button>
                    )}
                  </div>
                </div>
                <p className="mt-1.5 text-xs text-muted-foreground">PNG, JPG, SVG ou WebP. A imagem é reduzida automaticamente.</p>
                {logoError && <p className="mt-1 text-xs text-danger">{logoError}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Cor</label>
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="w-full h-10 p-1 border border-input rounded-lg bg-transparent cursor-pointer"
                />
              </div>

              {/* ITEM 1 — Toggle "Utilizar para controle de saldo" no modal */}
              <div className="flex items-start gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setIncludeInDashboard(!includeInDashboard)}
                  className={`relative flex-shrink-0 w-11 h-6 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary ${
                    includeInDashboard ? 'bg-primary' : 'bg-muted'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-5 h-5 bg-card rounded-full shadow transition-transform ${
                      includeInDashboard ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
                <div>
                  <p className="text-sm font-medium">
                    Utilizar para controle de saldo
                  </p>
                  <p className="text-xs text-foreground mt-0.5">
                    {includeInDashboard
                      ? 'Esta conta entra no Saldo Geral do Dashboard.'
                      : 'Esta conta NÃO aparece no Saldo Geral (ex: conta de investimentos separada).'}
                  </p>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm text-foreground hover:underline"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-primary hover:brightness-110 hover:-translate-y-px active:scale-[0.97] btn-sheen text-primary-foreground px-5 py-2 rounded-md text-sm font-medium transition disabled:opacity-50"
                >
                  {isSubmitting ? 'Salvando...' : editingId ? 'Salvar Alterações' : 'Criar Conta'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
