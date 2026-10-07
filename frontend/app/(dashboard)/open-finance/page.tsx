'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Landmark, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useAccounts } from '@/hooks/use-accounts';
import { api } from '@/services/api';
import { formatCurrency } from '@/utils/currency';
import { confirmDialog, notifyAlert } from '@/utils/notify';

interface Connection {
  id: string;
  itemId: string;
  label: string;
  lastSyncAt: string | null;
}

interface RemoteAccount {
  id: string;
  name: string;
  type: string;
  subtype: string | null;
  number: string | null;
  balance: number;
  supported: boolean;
  linkedAccountId: string | null;
}

const selectClass =
  'h-10 w-full rounded-md border border-input bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30';

const errorMessage = (err: any, fallback: string) => {
  const msg = err?.response?.data?.message;
  return Array.isArray(msg) ? msg.join('\n') : msg || fallback;
};

function ConnectionCard({ connection }: { connection: Connection }) {
  const queryClient = useQueryClient();
  const { data: accountsData } = useAccounts();
  const myAccounts = (accountsData?.items ?? []) as { id: string; name: string }[];

  const { data: remote, isLoading, isError } = useQuery({
    queryKey: ['open-finance', connection.id, 'accounts'],
    queryFn: () => api.get(`/open-finance/connections/${connection.id}/accounts`).then((r) => r.data.data as RemoteAccount[]),
  });

  const refreshAll = () => queryClient.invalidateQueries({ queryKey: ['open-finance'] });

  const link = useMutation({
    mutationFn: ({ pluggyAccountId, accountId }: { pluggyAccountId: string; accountId: string }) =>
      accountId
        ? api.put(`/open-finance/connections/${connection.id}/links`, { pluggyAccountId, accountId })
        : api.delete(`/open-finance/connections/${connection.id}/links/${pluggyAccountId}`),
    onSuccess: refreshAll,
    onError: (err) => notifyAlert(errorMessage(err, 'Não foi possível salvar o vínculo.')),
  });

  const sync = useMutation({
    mutationFn: () => api.post(`/open-finance/connections/${connection.id}/sync`).then((r) => r.data.data as { created: number; linkedAccounts: number }),
    onSuccess: (res) => {
      refreshAll();
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      toast.success(res.linkedAccounts === 0 ? 'Vincule uma conta antes de sincronizar.' : `${res.created} transação(ões) nova(s) importada(s).`);
    },
    onError: (err) => notifyAlert(errorMessage(err, 'Falha ao sincronizar.')),
  });

  const remove = useMutation({
    mutationFn: () => api.delete(`/open-finance/connections/${connection.id}`),
    onSuccess: refreshAll,
    onError: (err) => notifyAlert(errorMessage(err, 'Não foi possível remover a conexão.')),
  });

  const handleRemove = async () => {
    if (await confirmDialog(`Remover a conexão "${connection.label}"? As transações já importadas continuam no PouPay.`)) {
      remove.mutate();
    }
  };

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-3">
        <div className="min-w-0">
          <CardTitle className="truncate">{connection.label}</CardTitle>
          <p className="text-xs text-muted-foreground">
            {connection.lastSyncAt
              ? `Última sincronização: ${new Date(connection.lastSyncAt).toLocaleString('pt-BR')}`
              : 'Ainda não sincronizada'}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button size="sm" onClick={() => sync.mutate()} isLoading={sync.isPending}>
            {!sync.isPending && <RefreshCw className="h-3.5 w-3.5" />}
            Sincronizar
          </Button>
          <Button size="sm" variant="ghost" onClick={handleRemove} aria-label="Remover conexão">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading && <Skeleton className="h-16 w-full" />}
        {isError && <p className="text-sm text-danger">Não consegui ler as contas dessa conexão na Pluggy.</p>}
        {remote?.map((acc) => (
          <div key={acc.id} className="grid gap-2 rounded-lg border border-border/70 p-3 sm:grid-cols-[1fr_16rem] sm:items-center">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{acc.name}</p>
              <p className="text-xs text-muted-foreground">
                {acc.type === 'BANK' ? 'Conta bancária' : 'Cartão de crédito'}
                {acc.number ? ` · ${acc.number}` : ''} · {formatCurrency(acc.balance)}
              </p>
            </div>
            {acc.supported ? (
              <select
                className={selectClass}
                value={acc.linkedAccountId ?? ''}
                disabled={link.isPending}
                onChange={(e) => link.mutate({ pluggyAccountId: acc.id, accountId: e.target.value })}
              >
                <option value="">Não importar</option>
                {myAccounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    Importar para: {a.name}
                  </option>
                ))}
              </select>
            ) : (
              <p className="text-xs text-muted-foreground">Cartões de crédito ainda não são importados.</p>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export default function OpenFinancePage() {
  const queryClient = useQueryClient();
  const [itemId, setItemId] = useState('');
  const [label, setLabel] = useState('');

  const { data: connections, isLoading } = useQuery({
    queryKey: ['open-finance', 'connections'],
    queryFn: () => api.get('/open-finance/connections').then((r) => r.data.data as Connection[]),
  });

  const create = useMutation({
    mutationFn: () => api.post('/open-finance/connections', { itemId: itemId.trim(), label: label.trim() }),
    onSuccess: () => {
      setItemId('');
      setLabel('');
      queryClient.invalidateQueries({ queryKey: ['open-finance'] });
      toast.success('Conexão adicionada. Vincule as contas e sincronize.');
    },
    onError: (err) => notifyAlert(errorMessage(err, 'Não foi possível adicionar a conexão.')),
  });

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">Open Finance</h1>
        <p className="text-sm text-muted-foreground">
          Traga as transações do seu banco (via Pluggy) direto para as contas do PouPay.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Landmark className="h-4 w-4 text-primary" /> Nova conexão
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
            onSubmit={(e) => {
              e.preventDefault();
              create.mutate();
            }}
          >
            <div>
              <label className="mb-1 block text-sm font-medium">Nome</label>
              <Input required maxLength={60} placeholder="Ex: Nubank" value={label} onChange={(e) => setLabel(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Item ID (Meu Pluggy)</label>
              <Input required minLength={8} placeholder="Cole o itemId da conexão" value={itemId} onChange={(e) => setItemId(e.target.value)} />
            </div>
            <Button type="submit" isLoading={create.isPending}>
              {!create.isPending && <Plus className="h-4 w-4" />}
              Adicionar
            </Button>
          </form>
          <p className="mt-3 text-xs text-muted-foreground">
            O itemId aparece no painel do Meu Pluggy, na conexão que você já criou com o banco.
          </p>
        </CardContent>
      </Card>

      {isLoading && <Skeleton className="h-40 w-full" />}
      {connections?.map((c) => <ConnectionCard key={c.id} connection={c} />)}
    </div>
  );
}
