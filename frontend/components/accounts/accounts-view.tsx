'use client';

import { ImagePlus, Landmark, Pencil, Plus, Trash2, X } from 'lucide-react';
import { AccountAvatar } from '@/components/accounts/account-avatar';
import { fileToLogoDataUrl, isImageIcon } from '@/utils/image-resize';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { notifyAlert, confirmDialog } from '@/utils/notify';
import React, { useEffect, useState } from 'react';
import { api } from '@/services/api';
import { formatCurrency } from '@/utils/currency';
import { Story, Dim } from '@/components/ui/story';
import { Money } from '@/components/dashboard/month-story';

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

  const balanceOf = (a: Account) => Number(a.currentBalance ?? a.initialBalance ?? 0);
  const inTotal = accounts.filter((a) => a.includeInDashboard);
  const totalBalance = inTotal.reduce((sum, a) => sum + balanceOf(a), 0);
  // Mesma divisão do Início: "Disponível nas contas" exclui contas de investimento
  const investedBalance = inTotal.filter((a) => a.type === 'INVESTMENT').reduce((sum, a) => sum + balanceOf(a), 0);
  const availableBalance = totalBalance - investedBalance;

  return (
    <div>
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-3xl">
          {accounts.length === 0 ? (
            <Story>
              Cadastre suas contas <Dim>para acompanhar saldos num lugar só.</Dim>
            </Story>
          ) : (
            <Story>
              <Dim>Você tem</Dim> <Money value={totalBalance} className={totalBalance < 0 ? 'text-danger' : 'text-primary'} />{' '}
              <Dim>
                em {inTotal.length} {inTotal.length === 1 ? 'conta' : 'contas'}
                {investedBalance !== 0 ? ':' : '.'}
              </Dim>
              {investedBalance !== 0 && (
                <>
                  {' '}
                  <Money value={availableBalance} /> <Dim>para o dia a dia e</Dim> <Money value={investedBalance} /> <Dim>investidos.</Dim>
                </>
              )}
            </Story>
          )}
        </div>
        <button
          onClick={handleOpenCreate}
          className="btn-sheen inline-flex h-10 w-fit shrink-0 items-center gap-2 whitespace-nowrap rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-[inset_0_1px_0_hsl(0_0%_100%/0.18),0_6px_14px_-6px_hsl(var(--primary)/0.55)] transition-theme hover:-translate-y-px hover:brightness-110 active:scale-[0.97]"
        >
          <Plus className="h-4 w-4" strokeWidth={2.2} />
          Nova conta
        </button>
      </div>

      {loading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[4.25rem] rounded-2xl" />
          ))}
        </div>
      ) : accounts.length === 0 ? (
        <EmptyState
          className="rounded-[1.375rem] border border-dashed border-border"
          icon={Landmark}
          title="Nenhuma conta ainda"
          description="Cadastre sua primeira conta, carteira ou instituição para começar a acompanhar saldos."
          action={
            <button
              onClick={handleOpenCreate}
              className="h-10 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground transition-theme hover:brightness-110 active:scale-[0.97]"
            >
              Nova conta
            </button>
          }
        />
      ) : (
        // Uma lista só, estilo extrato: cada conta é uma linha (logo, nome, tipo,
        // saldo), em vez de uma grade de cartões iguais.
        <ul className="divide-y divide-border/60 overflow-hidden rounded-[1.75rem] bg-foreground/[0.03]">
          {accounts.map((acc) => {
            const balance = Number(acc.currentBalance ?? acc.initialBalance ?? 0);
            return (
              <li key={acc.id} className="group flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-foreground/[0.025] sm:gap-4 sm:px-5">
                <AccountAvatar name={acc.name} color={acc.color} icon={acc.icon} className="h-11 w-11" />

                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-[15px] font-semibold">
                    {/* No toque não há hover: o nome abre a edição (excluir fica lá dentro) */}
                    <button type="button" onClick={() => handleEdit(acc)} className="max-w-full truncate text-left [@media(hover:hover)]:pointer-events-none">
                      {acc.name}
                    </button>
                  </h3>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                    <span>{ACCOUNT_TYPE_LABELS[acc.type] ?? acc.type}</span>
                    {/* Alterna se a conta entra no Saldo Geral do Dashboard */}
                    <button
                      onClick={() => handleToggleDashboard(acc)}
                      aria-pressed={acc.includeInDashboard}
                      title={acc.includeInDashboard ? 'Clique para remover do Saldo Geral' : 'Clique para incluir no Saldo Geral'}
                      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-semibold transition-theme ${
                        acc.includeInDashboard
                          ? 'border-primary/30 bg-primary/10 text-primary'
                          : 'border-border text-muted-foreground hover:border-foreground/25 hover:text-foreground'
                      }`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${acc.includeInDashboard ? 'bg-primary' : 'bg-muted-foreground/50'}`} />
                      {acc.includeInDashboard ? 'No saldo geral' : 'Fora do saldo geral'}
                    </button>
                  </div>
                </div>

                <p className={`font-num shrink-0 text-base font-semibold sm:text-lg ${balance < 0 ? 'text-danger' : ''}`}>
                  {formatCurrency(acc.currentBalance ?? acc.initialBalance)}
                </p>

                <div className="hidden shrink-0 gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100 [@media(hover:hover)]:flex">
                  <button
                    onClick={() => handleEdit(acc)}
                    aria-label={`Editar ${acc.name}`}
                    title="Editar"
                    className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-theme hover:bg-primary/10 hover:text-primary"
                  >
                    <Pencil className="h-4 w-4" strokeWidth={1.9} />
                  </button>
                  <button
                    onClick={() => handleArchive(acc.id, acc.name)}
                    aria-label={`Excluir ${acc.name}`}
                    title="Excluir"
                    className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-theme hover:bg-danger/10 hover:text-danger"
                  >
                    <Trash2 className="h-4 w-4" strokeWidth={1.9} />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* Modal Criar / Editar */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-[2px] flex items-end justify-center z-50 sm:items-center sm:p-4">
        <div className="bg-card rounded-t-2xl sm:rounded-xl shadow-xl w-full max-w-md p-6 border border-border animate-rise max-h-[92dvh] overflow-y-auto sm:max-h-[90vh]">
            <div className="flex justify-between items-center mb-5">
              <h2 className="font-display text-xl font-bold tracking-tight">
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
                  className="w-full h-11 px-3 border border-input rounded-md bg-transparent focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Tipo de Conta</label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  className="w-full h-11 px-3 border border-input rounded-md bg-card focus:outline-none focus:ring-2 focus:ring-primary"
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
                  className="w-full h-11 px-3 border border-input rounded-md bg-transparent focus:outline-none focus:ring-2 focus:ring-primary"
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

              <div className="flex items-center justify-end gap-3 pt-3">
                {editingId && (
                  <button
                    type="button"
                    onClick={async () => {
                      const acc = accounts.find((a) => a.id === editingId);
                      if (!acc) return;
                      setIsModalOpen(false);
                      await handleArchive(acc.id, acc.name);
                    }}
                    aria-label="Excluir conta"
                    title="Excluir conta"
                    className="mr-auto flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground transition-theme hover:bg-danger/10 hover:text-danger"
                  >
                    <Trash2 className="h-[18px] w-[18px]" strokeWidth={1.9} />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="h-10 rounded-full px-4 text-sm font-semibold text-muted-foreground transition-theme hover:bg-foreground/[0.06] hover:text-foreground"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="btn-sheen h-10 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground transition-theme hover:-translate-y-px hover:brightness-110 active:scale-[0.97] disabled:opacity-50"
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
