'use client';

import { useEffect, useState } from 'react';
import { PiggyBank, TrendingUp } from 'lucide-react';
import { api } from '@/services/api';
import { formatCurrency } from '@/utils/currency';

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

  useEffect(() => {
    setLoading(true);
    const params: Record<string, string> = {};
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;

    api
      .get('/investments/contributions', { params })
      .then((res) => setData(res.data?.data ?? res.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [startDate, endDate]);

  const hasInvestmentAccount = (data?.investmentAccounts?.length ?? 0) > 0;

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold dark:text-white">Investimentos</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 mb-6">
        Histórico dos seus aportes mensais — o mesmo valor que aparece no card
        "Investido" do Dashboard.
      </p>

      <div className="bg-white dark:bg-zinc-900 rounded-xl shadow border border-gray-100 dark:border-zinc-800 p-4 mb-8 flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">De</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="px-3 py-2 border border-gray-300 dark:border-zinc-700 rounded-lg bg-transparent dark:text-white text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Até</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="px-3 py-2 border border-gray-300 dark:border-zinc-700 rounded-lg bg-transparent dark:text-white text-sm"
          />
        </div>
        {(startDate || endDate) && (
          <button
            onClick={() => { setStartDate(''); setEndDate(''); }}
            className="text-sm text-blue-600 hover:underline pb-2"
          >
            Limpar período
          </button>
        )}
      </div>

      {loading ? (
        <div className="text-gray-500 py-8">Carregando...</div>
      ) : !hasInvestmentAccount ? (
        <div className="bg-white dark:bg-zinc-900 rounded-xl shadow border border-gray-100 dark:border-zinc-800 p-10 flex flex-col items-center text-center gap-3">
          <div className="w-14 h-14 rounded-full bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center">
            <PiggyBank className="w-7 h-7 text-blue-600 dark:text-blue-400" />
          </div>
          <h2 className="text-lg font-semibold dark:text-white">Nenhuma conta de investimento ainda</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md">
            Cadastre uma conta do tipo "Investimento" na aba Contas e depois use
            o botão "Investir" ao lançar uma movimentação em Transações — os
            aportes vão aparecer aqui automaticamente.
          </p>
        </div>
      ) : (
        <>
          {/* Card de total acumulado */}
          <div className="bg-white dark:bg-zinc-900 rounded-xl shadow border border-gray-100 dark:border-zinc-800 p-6 mb-6 flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Total investido (histórico)</p>
              <p className="text-3xl font-bold text-blue-600 dark:text-blue-400 mt-1">
                {formatCurrency(data?.totalInvested ?? 0)}
              </p>
            </div>
            <div className="w-14 h-14 rounded-full bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center">
              <TrendingUp className="w-7 h-7 text-blue-600 dark:text-blue-400" />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Resumo mensal */}
            <div className="lg:col-span-1 bg-white dark:bg-zinc-900 rounded-xl shadow border border-gray-100 dark:border-zinc-800 p-6">
              <h2 className="font-semibold dark:text-white mb-4">Aportes por mês</h2>
              {(data?.monthly?.length ?? 0) === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">Nenhum aporte registrado ainda.</p>
              ) : (
                <div className="flex flex-col gap-3">
                  {data!.monthly.map((m) => (
                    <div key={m.month} className="flex items-center justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-300">{formatMonth(m.month)}</span>
                      <span className="font-semibold text-blue-600 dark:text-blue-400">
                        {formatCurrency(m.total)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Extrato detalhado */}
            <div className="lg:col-span-2 bg-white dark:bg-zinc-900 rounded-xl shadow border border-gray-100 dark:border-zinc-800 overflow-hidden">
              <div className="p-6 pb-0">
                <h2 className="font-semibold dark:text-white mb-4">Extrato de aportes</h2>
              </div>
              {(data?.contributions?.length ?? 0) === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400 p-6 pt-0">
                  Nenhum aporte registrado ainda.
                </p>
              ) : (
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 dark:border-zinc-800 text-gray-500 dark:text-gray-400">
                      <th className="px-6 py-2 font-medium">Data</th>
                      <th className="px-6 py-2 font-medium">Descrição</th>
                      <th className="px-6 py-2 font-medium">Conta</th>
                      <th className="px-6 py-2 font-medium text-right">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data!.contributions.map((c) => (
                      <tr key={c.id} className="border-b border-gray-50 dark:border-zinc-800/50">
                        <td className="px-6 py-3 text-gray-500 dark:text-gray-400">
                          {new Date(c.date).toLocaleDateString('pt-BR')}
                        </td>
                        <td className="px-6 py-3 dark:text-gray-200">
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
                        <td className="px-6 py-3 text-right font-semibold text-blue-600 dark:text-blue-400">
                          {formatCurrency(c.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
