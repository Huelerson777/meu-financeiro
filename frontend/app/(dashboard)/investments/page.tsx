'use client';

import { confirmDialog } from '@/utils/notify';
import { useEffect, useState } from 'react';
import { PiggyBank, Plus, TrendingUp, Trash2, Pencil } from 'lucide-react';
import { api } from '@/services/api';
import { formatCurrency } from '@/utils/currency';
import { useInvestmentPositions } from '@/hooks/use-investments';
import { investmentsService, InvestmentPosition } from '@/services/investments.service';
import { InvestModal } from '@/components/investments/invest-modal';
import { EditPositionModal } from '@/components/investments/edit-position-modal';
import { Button } from '@/components/ui/button';

const CATEGORY_LABELS: Record<string, string> = {
  FIXED_INCOME: 'Renda fixa',
  STOCK: 'Ação',
  FUND: 'Fundo/FII',
  CRYPTO: 'Criptomoeda',
  REAL_ESTATE: 'Imóvel',
  OTHER: 'Outro',
};

const INDEXER_LABELS: Record<string, string> = {
  CDI: '% do CDI',
  SELIC: '% da Selic',
  IPCA_PLUS: 'IPCA+',
  PREFIXADO: 'Prefixado',
};

interface Contribution {
  id: string;
  date: string;
  amount: number;
  description: string | null;
  fromAccountName: string;
  toAccountName: string;
  toAccountColor: string | null;
}

interface MonthlyItem {
  month: string; // "2026-08"
  total: number;
}

interface ContributionsResponse {
  totalInvested: number;
  monthly: MonthlyItem[];
  contributions: Contribution[];
  investmentAccounts: { id: string; name: string; color: string | null }[];
}

const MONTH_LABELS: Record<string, string> = {
  '01': 'Jan', '02': 'Fev', '03': 'Mar', '04': 'Abr', '05': 'Mai', '06': 'Jun',
  '07': 'Jul', '08': 'Ago', '09': 'Set', '10': 'Out', '11': 'Nov', '12': 'Dez',
};

function formatMonth(key: string) {
  const [year, month] = key.split('-');
  return `${MONTH_LABELS[month] ?? month}/${year}`;
}

export default function InvestmentsPage() {
  const [data, setData] = useState<ContributionsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isInvestModalOpen, setIsInvestModalOpen] = useState(false);
  const [editingPosition, setEditingPosition] = useState<InvestmentPosition | null>(null);
  const { data: positions, isLoading: positionsLoading, refetch: refetchPositions } = useInvestmentPositions();

  const fetchContributions = () => {
    setLoading(true);
    const params: Record<string, string> = {};
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;

    return api
      .get('/investments/contributions', { params })
      .then((res) => setData(res.data?.data ?? res.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  };

  const handleDeletePosition = async (id: string, name: string) => {
    if (!(await confirmDialog(`Excluir "${name}"? Isso também remove o aporte associado.`))) return;
    await investmentsService.deletePosition(id);
    // Excluir a posição também exclui o aporte (Transfer) vinculado — precisa
    // atualizar os dois, não só a lista de posições.
    refetchPositions();
    fetchContributions();
  };

  useEffect(() => {
    fetchContributions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate]);

  const hasInvestmentAccount = (data?.investmentAccounts?.length ?? 0) > 0;

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Investimentos</h1>
          <p className="text-sm text-muted-foreground mt-1 mb-6">
            Histórico dos seus aportes mensais — o mesmo valor que aparece no card
            "Investido" do Dashboard.
          </p>
        </div>
        <Button onClick={() => setIsInvestModalOpen(true)} className="gap-1.5">
          <Plus className="w-4 h-4" />
          Novo aporte
        </Button>
      </div>

      <div className="bg-card rounded-xl shadow-soft border border-border/70 p-4 mb-8 flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs font-medium text-foreground mb-1">De</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="h-11 px-3 border border-input rounded-md bg-transparent text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-foreground mb-1">Até</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="h-11 px-3 border border-input rounded-md bg-transparent text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
          />
        </div>
        {(startDate || endDate) && (
          <button
            onClick={() => { setStartDate(''); setEndDate(''); }}
            className="text-sm text-primary hover:underline pb-2"
          >
            Limpar período
          </button>
        )}
      </div>

      {loading ? (
        <div className="text-foreground py-8">Carregando...</div>
      ) : !hasInvestmentAccount ? (
        <div className="bg-card rounded-xl shadow-soft border border-border/70 p-10 flex flex-col items-center text-center gap-3">
          <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
            <PiggyBank className="w-7 h-7 text-primary" />
          </div>
          <h2 className="text-lg font-semibold">Nenhuma conta de investimento ainda</h2>
          <p className="text-sm text-foreground max-w-md">
            Cadastre uma conta do tipo "Investimento" na aba Contas e depois use
            o botão "Novo aporte" acima — os aportes vão aparecer aqui
            automaticamente.
          </p>
        </div>
      ) : (
        <>
          {/* Card de total acumulado */}
          <div className="bg-card rounded-xl shadow-soft border border-border/70 p-6 mb-6 flex items-center justify-between">
            <div>
              <p className="text-sm text-foreground">Total investido (histórico)</p>
              <p className="text-3xl font-bold text-primary mt-1">
                {formatCurrency(data?.totalInvested ?? 0)}
              </p>
            </div>
            <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
              <TrendingUp className="w-7 h-7 text-primary" />
            </div>
          </div>

          {/* Posições registradas (opcional — quem só usa aporte simples não tem nenhuma aqui) */}
          <div className="bg-card rounded-xl shadow-soft border border-border/70 overflow-hidden mb-8">
            <div className="p-6 pb-0">
              <h2 className="font-semibold mb-1">Minhas posições</h2>
              <p className="text-xs text-foreground mb-4">
                Ativos registrados com "Registrar ativo" em "Novo aporte" — valor atualizado automaticamente pra renda fixa e ações/fundos com ticker.
              </p>
            </div>
            {positionsLoading ? (
              <div className="text-sm text-foreground p-6 pt-0">Carregando...</div>
            ) : !positions || positions.length === 0 ? (
              <p className="text-sm text-foreground p-6 pt-0">
                Nenhuma posição registrada ainda. Clique em "Novo aporte" e escolha "Registrar ativo".
              </p>
            ) : (
              <>
              <ul className="divide-y divide-border md:hidden">
                {positions.map((p) => (
                  <li key={p.id} className="flex flex-col gap-2 px-5 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{p.name}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {CATEGORY_LABELS[p.category] ?? p.category}
                          {(p.ticker || p.indexer) && ` · ${p.ticker || (p.indexer ? `${p.rate ?? ''} ${INDEXER_LABELS[p.indexer]}` : '')}`}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="font-num text-base font-bold">{formatCurrency(p.current)}</p>
                        <p className={`text-xs font-semibold ${p.profit >= 0 ? 'text-success' : 'text-danger'}`}>
                          {p.profit >= 0 ? '+' : ''}{formatCurrency(p.profit)} ({p.profitPct.toFixed(2)}%)
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Investido: {formatCurrency(p.invested)}</span>
                      <div className="flex gap-4">
                        <button onClick={() => setEditingPosition(p)} className="flex items-center gap-1 py-1 font-semibold text-primary">
                          <Pencil className="h-3.5 w-3.5" /> Editar
                        </button>
                        <button onClick={() => handleDeletePosition(p.id, p.name)} className="flex items-center gap-1 py-1 font-semibold text-danger">
                          <Trash2 className="h-3.5 w-3.5" /> Excluir
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
              <div className="hidden overflow-x-auto md:block"><table className="min-w-[640px] w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-foreground">
                    <th className="px-6 py-2 font-medium">Ativo</th>
                    <th className="px-6 py-2 font-medium">Categoria</th>
                    <th className="px-6 py-2 font-medium text-right">Investido</th>
                    <th className="px-6 py-2 font-medium text-right">Atual</th>
                    <th className="px-6 py-2 font-medium text-right">Rendimento</th>
                    <th className="px-6 py-2 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {positions.map((p) => (
                    <tr key={p.id} className="border-b border-border">
                      <td className="px-6 py-3">
                        {p.name}
                        {(p.ticker || p.indexer) && (
                          <span className="ml-2 text-xs font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                            {p.ticker || (p.indexer ? `${p.rate ?? ''} ${INDEXER_LABELS[p.indexer]}` : '')}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-3 text-foreground">{CATEGORY_LABELS[p.category] ?? p.category}</td>
                      <td className="px-6 py-3 text-right">{formatCurrency(p.invested)}</td>
                      <td className="px-6 py-3 text-right font-semibold">{formatCurrency(p.current)}</td>
                      <td className={`px-6 py-3 text-right font-semibold ${p.profit >= 0 ? 'text-success' : 'text-danger'}`}>
                        {p.profit >= 0 ? '+' : ''}{formatCurrency(p.profit)} ({p.profitPct.toFixed(2)}%)
                      </td>
                      <td className="px-6 py-3 text-right">
                        <div className="flex items-center justify-end gap-3">
                          <button
                            onClick={() => setEditingPosition(p)}
                            className="text-foreground hover:text-primary transition"
                            title="Editar posição"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeletePosition(p.id, p.name)}
                            className="text-foreground hover:text-danger transition"
                            title="Excluir posição"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table></div>
              </>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Resumo mensal */}
            <div className="lg:col-span-1 bg-card rounded-xl shadow-soft border border-border/70 p-6">
              <h2 className="font-semibold mb-4">Aportes por mês</h2>
              {(data?.monthly?.length ?? 0) === 0 ? (
                <p className="text-sm text-foreground">Nenhum aporte registrado ainda.</p>
              ) : (
                <div className="flex flex-col gap-3">
                  {data!.monthly.map((m) => (
                    <div key={m.month} className="flex items-center justify-between text-sm">
                      <span className="text-foreground">{formatMonth(m.month)}</span>
                      <span className="font-semibold text-primary">
                        {formatCurrency(m.total)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Extrato detalhado */}
            <div className="lg:col-span-2 bg-card rounded-xl shadow-soft border border-border/70 overflow-hidden">
              <div className="p-6 pb-0">
                <h2 className="font-semibold mb-4">Extrato de aportes</h2>
              </div>
              {(data?.contributions?.length ?? 0) === 0 ? (
                <p className="text-sm text-foreground p-6 pt-0">
                  Nenhum aporte registrado ainda.
                </p>
              ) : (
                <>
                <ul className="divide-y divide-border md:hidden">
                  {data!.contributions.map((c) => (
                    <li key={c.id} className="flex items-center justify-between gap-3 px-5 py-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{c.description || 'Aporte de Investimento'}</p>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          {new Date(c.date).toLocaleDateString('pt-BR')} · {c.toAccountName}
                        </p>
                      </div>
                      <p className="font-num shrink-0 text-base font-bold text-primary">{formatCurrency(c.amount)}</p>
                    </li>
                  ))}
                </ul>
                <div className="hidden overflow-x-auto md:block"><table className="min-w-[640px] w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-border text-foreground">
                      <th className="px-6 py-2 font-medium">Data</th>
                      <th className="px-6 py-2 font-medium">Descrição</th>
                      <th className="px-6 py-2 font-medium">Conta</th>
                      <th className="px-6 py-2 font-medium text-right">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data!.contributions.map((c) => (
                      <tr key={c.id} className="border-b border-border">
                        <td className="px-6 py-3 text-foreground">
                          {new Date(c.date).toLocaleDateString('pt-BR')}
                        </td>
                        <td className="px-6 py-3">
                          {c.description || 'Aporte de Investimento'}
                        </td>
                        <td className="px-6 py-3">
                          <span
                            className="text-xs font-semibold px-2 py-0.5 rounded-full"
                            style={{
                              backgroundColor: `${c.toAccountColor ?? '#3b82f6'}20`,
                              color: c.toAccountColor ?? '#3b82f6',
                            }}
                          >
                            {c.toAccountName}
                          </span>
                        </td>
                        <td className="px-6 py-3 text-right font-semibold text-primary">
                          {formatCurrency(c.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table></div>
                </>
              )}
            </div>
          </div>
        </>
      )}

      <InvestModal
        open={isInvestModalOpen}
        onClose={() => setIsInvestModalOpen(false)}
        onCreated={() => {
          fetchContributions();
          refetchPositions();
        }}
      />

      <EditPositionModal
        position={editingPosition}
        onClose={() => setEditingPosition(null)}
        onSaved={() => {
          fetchContributions();
          refetchPositions();
        }}
      />
    </div>
  );
}
