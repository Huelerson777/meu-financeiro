'use client';

import { useEffect, useState } from 'react';
import { Download, TrendingUp, TrendingDown, Scale } from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, Cell, Tooltip as RechartsTooltip,
  ResponsiveContainer, XAxis, YAxis, CartesianGrid,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChartTooltip, SingleValueTooltip } from '@/components/dashboard/chart-tooltips';
import { SummaryCard } from '@/components/dashboard/summary-card';
import { useCashFlowReport, useCategoryReport, useAccountStatement } from '@/hooks/use-reports';
import { reportsService } from '@/services/reports.service';
import { formatCurrency } from '@/utils/currency';
import { api } from '@/services/api';

interface AccountOption {
  id: string;
  name: string;
}

function toISODate(d: Date) {
  return d.toISOString().split('T')[0];
}

function presetRange(preset: 'thisMonth' | 'lastMonth' | 'thisYear') {
  const now = new Date();
  if (preset === 'thisMonth') {
    return { startDate: toISODate(new Date(now.getFullYear(), now.getMonth(), 1)), endDate: toISODate(new Date(now.getFullYear(), now.getMonth() + 1, 0)) };
  }
  if (preset === 'lastMonth') {
    return { startDate: toISODate(new Date(now.getFullYear(), now.getMonth() - 1, 1)), endDate: toISODate(new Date(now.getFullYear(), now.getMonth(), 0)) };
  }
  return { startDate: toISODate(new Date(now.getFullYear(), 0, 1)), endDate: toISODate(new Date(now.getFullYear(), 11, 31)) };
}

function formatSeriesLabel(key: string) {
  // "2026-09" -> "set/26" | "2026-09-14" -> "14/09"
  const parts = key.split('-');
  if (parts.length === 2) {
    const [year, month] = parts;
    const label = new Date(Number(year), Number(month) - 1, 1).toLocaleDateString('pt-BR', { month: 'short' });
    return `${label}/${year.slice(2)}`;
  }
  const [, month, day] = parts;
  return `${day}/${month}`;
}

function downloadCsv(csv: string, filename: string) {
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export default function ReportsPage() {
  const [range, setRange] = useState(presetRange('thisMonth'));
  const [categoryType, setCategoryType] = useState<'INCOME' | 'EXPENSE'>('EXPENSE');
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    api.get('/accounts').then((res) => {
      const raw = res.data;
      const list: AccountOption[] = Array.isArray(raw) ? raw : Array.isArray(raw?.data?.items) ? raw.data.items : [];
      setAccounts(list);
      if (list.length > 0) setSelectedAccountId((prev) => prev ?? list[0].id);
    }).catch(() => setAccounts([]));
  }, []);

  const { data: cashFlow, isLoading: cashFlowLoading } = useCashFlowReport(range);
  const { data: categoryReport, isLoading: categoryLoading } = useCategoryReport({ ...range, type: categoryType });
  const { data: statement, isLoading: statementLoading } = useAccountStatement(selectedAccountId, range);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const { csv, filename } = await reportsService.exportTransactionsCsv(range);
      downloadCsv(csv, filename);
    } catch {
      alert('Erro ao exportar transações.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Relatórios</h1>
          <p className="text-sm text-muted-foreground">Fluxo de caixa, categorias e extrato por período.</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            type="date" value={range.startDate}
            onChange={(e) => setRange((r) => ({ ...r, startDate: e.target.value }))}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          />
          <span className="text-sm text-muted-foreground">até</span>
          <input
            type="date" value={range.endDate}
            onChange={(e) => setRange((r) => ({ ...r, endDate: e.target.value }))}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          />
          <div className="flex gap-1">
            <Button variant="outline" size="sm" onClick={() => setRange(presetRange('thisMonth'))}>Este mês</Button>
            <Button variant="outline" size="sm" onClick={() => setRange(presetRange('lastMonth'))}>Mês passado</Button>
            <Button variant="outline" size="sm" onClick={() => setRange(presetRange('thisYear'))}>Este ano</Button>
          </div>
          <Button size="sm" onClick={handleExport} isLoading={isExporting}>
            <Download className="h-4 w-4" /> Exportar CSV
          </Button>
        </div>
      </div>

      {/* Fluxo de caixa: 3 cards + série temporal */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <SummaryCard label="Receitas no período" value={cashFlow?.totalIncome} icon={TrendingUp} tone="success" isLoading={cashFlowLoading} />
        <SummaryCard label="Despesas no período" value={cashFlow?.totalExpense} icon={TrendingDown} tone="danger" isLoading={cashFlowLoading} />
        <SummaryCard
          label="Saldo do período"
          value={cashFlow?.balance}
          icon={Scale}
          tone={(cashFlow?.balance ?? 0) >= 0 ? 'success' : 'danger'}
          isLoading={cashFlowLoading}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Fluxo de caixa</CardTitle>
        </CardHeader>
        <CardContent className="h-72 pt-4">
          {cashFlowLoading ? (
            <div className="h-full flex items-center justify-center text-muted-foreground text-sm">Carregando...</div>
          ) : !cashFlow || cashFlow.series.length === 0 ? (
            <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
              Nenhuma movimentação paga neste período.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={cashFlow.series.map((s) => ({ ...s, label: formatSeriesLabel(s.key) }))} margin={{ left: 8, right: 8, top: 20 }}>
                <defs>
                  <linearGradient id="repColorReceitas" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#16a34a" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#16a34a" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="repColorDespesas" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#dc2626" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#dc2626" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} width={70} />
                <RechartsTooltip content={<ChartTooltip />} />
                <Area type="monotone" dataKey="receitas" name="Receitas" stroke="#16a34a" fill="url(#repColorReceitas)" strokeWidth={2} />
                <Area type="monotone" dataKey="despesas" name="Despesas" stroke="#dc2626" fill="url(#repColorDespesas)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Por categoria */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Por categoria</CardTitle>
          <div className="flex gap-1 p-0.5 bg-muted rounded-md">
            <button
              onClick={() => setCategoryType('EXPENSE')}
              className={`px-3 py-1 text-xs font-medium rounded transition ${categoryType === 'EXPENSE' ? 'bg-card shadow text-foreground' : 'text-muted-foreground'}`}
            >
              Despesas
            </button>
            <button
              onClick={() => setCategoryType('INCOME')}
              className={`px-3 py-1 text-xs font-medium rounded transition ${categoryType === 'INCOME' ? 'bg-card shadow text-foreground' : 'text-muted-foreground'}`}
            >
              Receitas
            </button>
          </div>
        </CardHeader>
        <CardContent>
          {categoryLoading ? (
            <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">Carregando...</div>
          ) : !categoryReport || categoryReport.items.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">
              Nenhum lançamento com categoria neste período.
            </div>
          ) : (
            <div style={{ height: Math.max(64 * categoryReport.items.length, 200) }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart layout="vertical" data={categoryReport.items} margin={{ left: 20, right: 90 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="name" width={150} stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                  <RechartsTooltip content={<SingleValueTooltip />} />
                  <Bar dataKey="amount" radius={[0, 4, 4, 0]} barSize={22}>
                    {categoryReport.items.map((entry, index) => (
                      <Cell key={`cat-cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
          {categoryReport && categoryReport.items.length > 0 && (
            <div className="mt-4 flex flex-col divide-y divide-border">
              {categoryReport.items.map((item) => (
                <div key={item.categoryId ?? 'none'} className="flex items-center justify-between py-2 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                    {item.name}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground">{item.percentage}%</span>
                    <span className="font-medium">{formatCurrency(item.amount)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Extrato de conta */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Extrato de conta</CardTitle>
          <select
            value={selectedAccountId ?? ''}
            onChange={(e) => setSelectedAccountId(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          >
            {accounts.map((acc) => (
              <option key={acc.id} value={acc.id}>{acc.name}</option>
            ))}
          </select>
        </CardHeader>
        <CardContent>
          {!selectedAccountId ? (
            <p className="text-sm text-muted-foreground text-center py-6">Nenhuma conta cadastrada.</p>
          ) : statementLoading ? (
            <p className="text-sm text-muted-foreground text-center py-6">Carregando...</p>
          ) : !statement ? (
            <p className="text-sm text-muted-foreground text-center py-6">Não foi possível carregar o extrato.</p>
          ) : (
            <>
              <div className="flex justify-between items-center text-sm mb-3 px-1">
                <span className="text-muted-foreground">Saldo inicial: <strong className="text-foreground">{formatCurrency(statement.openingBalance)}</strong></span>
                <span className="text-muted-foreground">Saldo final: <strong className="text-foreground">{formatCurrency(statement.closingBalance)}</strong></span>
              </div>
              {statement.lines.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">Sem movimentações neste período.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-muted-foreground">
                        <th className="py-2 pr-3 font-medium">Data</th>
                        <th className="py-2 pr-3 font-medium">Descrição</th>
                        <th className="py-2 pr-3 font-medium text-right">Valor</th>
                        <th className="py-2 pl-3 font-medium text-right">Saldo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {statement.lines.map((line, idx) => (
                        <tr key={idx} className="border-b border-border/50 last:border-0">
                          <td className="py-2 pr-3 whitespace-nowrap text-muted-foreground">{new Date(line.date).toLocaleDateString('pt-BR')}</td>
                          <td className="py-2 pr-3">
                            {line.description}
                            <span className="ml-2 text-xs text-muted-foreground">{line.kind}</span>
                          </td>
                          <td className={`py-2 pr-3 text-right font-medium ${line.amount >= 0 ? 'text-success' : 'text-danger'}`}>
                            {line.amount >= 0 ? '+ ' : ''}{formatCurrency(line.amount)}
                          </td>
                          <td className="py-2 pl-3 text-right text-muted-foreground">{formatCurrency(line.balanceAfter)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
