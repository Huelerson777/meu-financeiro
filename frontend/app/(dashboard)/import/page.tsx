'use client';

import { useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, ArrowLeft, CheckCircle2, FileUp } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { AccountAvatar } from '@/components/accounts/account-avatar';
import { useAccounts } from '@/hooks/use-accounts';
import { api } from '@/services/api';
import { formatCurrency } from '@/utils/currency';
import { notifyAlert } from '@/utils/notify';
import {
  csvToRows, guessColumns, parseCsv, parseOfx, readFileText, type ColumnMapping, type CsvTable, type ParsedRow,
} from '@/utils/statement-parser';
import { cn } from '@/utils/cn';

interface PreviewRow extends ParsedRow {
  key: number;
  duplicate: boolean;
  categoryId: string | null;
  include: boolean;
}

interface CategoryItem {
  id: string;
  name: string;
  color: string;
}

function listOf(raw: any): any[] {
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw?.data)) return raw.data;
  if (Array.isArray(raw?.items)) return raw.items;
  if (Array.isArray(raw?.data?.items)) return raw.data.items;
  return [];
}

const selectClass =
  'h-10 w-full rounded-md border border-input bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30';

export default function ImportPage() {
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const { data: accountsData, isLoading: accountsLoading } = useAccounts();
  const accounts = (accountsData?.items ?? []) as any[];

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: () => api.get('/categories').then((r) => listOf(r.data) as CategoryItem[]).catch(() => [] as CategoryItem[]),
  });

  const [accountId, setAccountId] = useState('');
  const [fileName, setFileName] = useState('');
  const [csv, setCsv] = useState<CsvTable | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping | null>(null);
  const [invert, setInvert] = useState(false);
  const [parsed, setParsed] = useState<ParsedRow[] | null>(null);
  const [rows, setRows] = useState<PreviewRow[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<number | null>(null);

  const reset = () => {
    setFileName('');
    setCsv(null);
    setMapping(null);
    setParsed(null);
    setRows(null);
    setDone(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  const account = accounts.find((a) => a.id === (accountId || accounts[0]?.id));
  const effectiveAccountId = account?.id ?? '';

  const loadPreview = async (parsedRows: ParsedRow[]) => {
    if (parsedRows.length === 0) {
      notifyAlert('Não encontrei lançamentos nesse arquivo. Confira se é um extrato (OFX ou CSV) e as colunas escolhidas.');
      return;
    }
    if (parsedRows.length > 500) {
      notifyAlert('O arquivo tem mais de 500 lançamentos. Importe por períodos menores.');
      return;
    }
    setBusy(true);
    try {
      const res = await api.post('/transactions/import/preview', { accountId: effectiveAccountId, rows: parsedRows });
      const info = listOf(res.data?.data ?? res.data) as { duplicate: boolean; categoryId: string | null }[];
      setRows(
        parsedRows.map((r, i) => ({
          ...r,
          key: i,
          duplicate: !!info[i]?.duplicate,
          categoryId: info[i]?.categoryId ?? null,
          include: !info[i]?.duplicate,
        })),
      );
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      notifyAlert(Array.isArray(msg) ? msg.join(' · ') : msg || 'Não foi possível analisar o arquivo.');
    } finally {
      setBusy(false);
    }
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    reset();
    setFileName(file.name);
    try {
      const text = await readFileText(file);
      if (/\.(ofx|qfx)$/i.test(file.name) || /<OFX>|<STMTTRN>/i.test(text)) {
        const list = parseOfx(text);
        setParsed(list);
        await loadPreview(list);
      } else {
        const table = parseCsv(text);
        if (table.headers.length === 0 || table.rows.length === 0) {
          notifyAlert('Não consegui ler esse arquivo. Use um extrato em OFX ou CSV.');
          return;
        }
        setCsv(table);
        const guess = guessColumns(table);
        setMapping(guess);
        setParsed(csvToRows(table, guess, false));
      }
    } catch {
      notifyAlert('Não foi possível ler o arquivo.');
    }
  };

  const remap = (patch: Partial<ColumnMapping>, inv = invert) => {
    if (!csv || !mapping) return;
    const next = { ...mapping, ...patch };
    setMapping(next);
    setParsed(csvToRows(csv, next, inv));
  };

  const included = useMemo(() => (rows ?? []).filter((r) => r.include), [rows]);
  const totalIn = included.filter((r) => r.amount > 0).reduce((s, r) => s + r.amount, 0);
  const totalOut = included.filter((r) => r.amount < 0).reduce((s, r) => s + -r.amount, 0);
  const duplicates = (rows ?? []).filter((r) => r.duplicate).length;

  const patchRow = (key: number, patch: Partial<PreviewRow>) => setRows((prev) => (prev ?? []).map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const doImport = async () => {
    if (included.length === 0) return;
    setBusy(true);
    try {
      const res = await api.post('/transactions/import', {
        accountId: effectiveAccountId,
        rows: included.map((r) => ({
          date: r.date,
          description: r.description.slice(0, 200),
          amount: Math.abs(r.amount),
          type: r.amount >= 0 ? 'INCOME' : 'EXPENSE',
          ...(r.categoryId ? { categoryId: r.categoryId } : {}),
        })),
      });
      const created = (res.data?.data ?? res.data)?.created ?? included.length;
      setDone(created);
      toast.success(`${created} lançamentos importados`);
      queryClient.invalidateQueries();
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      notifyAlert(Array.isArray(msg) ? msg.join(' · ') : msg || 'Não foi possível importar. Nada foi gravado.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/transactions" className="mb-3 inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground transition-theme hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Transações
        </Link>
        <h1 className="font-display text-3xl font-bold tracking-tight">Importar extrato</h1>
        <p className="mt-1 text-sm text-muted-foreground">Suba o arquivo OFX ou CSV do banco, confira a prévia e importe só o que ainda não está no app.</p>
      </div>

      {done != null ? (
        <Card>
          <CardContent className="flex flex-col items-center px-6 py-12 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-xl bg-success/10 text-success">
              <CheckCircle2 className="h-7 w-7" strokeWidth={1.6} />
            </span>
            <p className="font-display mt-4 text-xl font-bold">{done} lançamentos importados</p>
            <p className="mt-1 text-sm text-muted-foreground">O saldo da conta já foi atualizado.</p>
            <div className="mt-6 flex gap-2">
              <Link href="/transactions" className="inline-flex h-10 items-center rounded-md bg-primary px-5 text-sm font-semibold text-primary-foreground transition-theme hover:brightness-110 active:scale-[0.97]">
                Ver transações
              </Link>
              <Button variant="outline" onClick={reset}>Importar outro arquivo</Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>1. Conta e arquivo</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
              <label className="flex flex-col gap-1.5 text-sm font-medium">
                Conta de destino
                {accountsLoading ? (
                  <Skeleton className="h-10" />
                ) : (
                  <div className="flex items-center gap-2">
                    {account && <AccountAvatar name={account.name} color={account.color} icon={account.icon} className="h-10 w-10" />}
                    <select value={effectiveAccountId} onChange={(e) => { setAccountId(e.target.value); setRows(null); }} className={selectClass}>
                      {accounts.map((a) => (
                        <option key={a.id} value={a.id}>{a.name}</option>
                      ))}
                    </select>
                  </div>
                )}
              </label>

              <div>
                <p className="mb-1.5 text-sm font-medium">Extrato (OFX, QFX ou CSV)</p>
                <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-input px-4 py-4 text-sm transition-theme hover:border-primary/50 hover:bg-primary/5">
                  <FileUp className="h-5 w-5 shrink-0 text-primary" strokeWidth={1.75} />
                  <span className="min-w-0 truncate">{fileName || 'Escolher arquivo do banco'}</span>
                  <input ref={fileRef} type="file" accept=".ofx,.qfx,.csv,.txt,text/csv" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} />
                </label>
                <p className="mt-1.5 text-xs text-muted-foreground">O arquivo é lido no seu navegador; só as linhas escolhidas são enviadas.</p>
              </div>
            </CardContent>
          </Card>

          {csv && mapping && !rows && (
            <Card>
              <CardHeader>
                <CardTitle>2. Colunas do CSV</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="grid gap-3 sm:grid-cols-3">
                  {([['date', 'Data'], ['description', 'Descrição'], ['amount', 'Valor']] as const).map(([key, label]) => (
                    <label key={key} className="flex flex-col gap-1.5 text-sm font-medium">
                      {label}
                      <select value={mapping[key]} onChange={(e) => remap({ [key]: Number(e.target.value) })} className={selectClass}>
                        {csv.headers.map((h, i) => (
                          <option key={i} value={i}>{h || `Coluna ${i + 1}`}</option>
                        ))}
                      </select>
                    </label>
                  ))}
                </div>
                <label className="flex items-center gap-2 text-sm text-muted-foreground">
                  <input type="checkbox" checked={invert} onChange={(e) => { setInvert(e.target.checked); remap({}, e.target.checked); }} className="h-4 w-4 rounded border-border" />
                  Inverter entradas e saídas (use se o banco manda gastos como valores positivos)
                </label>
                <div className="overflow-x-auto rounded-lg border border-border/70">
                  <table className="w-full text-left text-xs">
                    <tbody>
                      {(parsed ?? []).slice(0, 4).map((r, i) => (
                        <tr key={i} className="border-b border-border/60 last:border-0">
                          <td className="px-3 py-2 text-muted-foreground">{r.date}</td>
                          <td className="px-3 py-2">{r.description}</td>
                          <td className={cn('px-3 py-2 text-right font-semibold', r.amount < 0 ? 'text-danger' : 'text-success')}>{formatCurrency(r.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs text-muted-foreground">{parsed?.length ?? 0} lançamentos reconhecidos.</p>
                  <Button onClick={() => parsed && loadPreview(parsed)} isLoading={busy} disabled={!parsed || parsed.length === 0}>Analisar</Button>
                </div>
              </CardContent>
            </Card>
          )}

          {busy && !rows && <Skeleton className="h-48 rounded-xl" />}

          {rows && (
            <Card>
              <CardHeader className="flex-row flex-wrap items-center justify-between gap-2 space-y-0">
                <CardTitle>{csv ? '3' : '2'}. Prévia</CardTitle>
                <p className="text-xs text-muted-foreground">
                  {rows.length} no arquivo · {duplicates > 0 ? `${duplicates} possíveis duplicatas desmarcadas` : 'nenhuma duplicata'}
                </p>
              </CardHeader>
              <CardContent>
                {duplicates > 0 && (
                  <p className="mb-4 flex items-start gap-2 rounded-md bg-warning/10 p-3 text-xs leading-relaxed text-warning">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    Itens marcados como duplicata têm a mesma data, valor e sentido de algo que já existe nesta conta. Eles vêm desmarcados; marque se for um lançamento realmente repetido.
                  </p>
                )}
                <ul className="divide-y divide-border/70">
                  {rows.map((r) => (
                    <li key={r.key} className={cn('flex flex-col gap-2 py-3 sm:flex-row sm:items-center', !r.include && 'opacity-50')}>
                      <label className="flex min-w-0 flex-1 items-center gap-3">
                        <input type="checkbox" checked={r.include} onChange={(e) => patchRow(r.key, { include: e.target.checked })} className="h-4 w-4 shrink-0 rounded border-border" />
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium">{r.description}</span>
                          <span className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                            {new Date(`${r.date}T12:00:00`).toLocaleDateString('pt-BR')}
                            {r.duplicate && <span className="rounded bg-warning/10 px-1.5 py-px text-[10px] font-bold uppercase text-warning">possível duplicata</span>}
                          </span>
                        </span>
                      </label>
                      <div className="flex items-center justify-between gap-3 pl-7 sm:pl-0">
                        <select
                          value={r.categoryId ?? ''}
                          onChange={(e) => patchRow(r.key, { categoryId: e.target.value || null })}
                          className="h-9 w-44 max-w-[55%] rounded-md border border-input bg-card px-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 sm:max-w-none"
                        >
                          <option value="">Sem categoria</option>
                          {categories.map((c) => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                        <span className={cn('font-num w-28 shrink-0 text-right text-sm font-bold', r.amount < 0 ? 'text-danger' : 'text-success')}>
                          {r.amount > 0 ? '+ ' : '- '}
                          {formatCurrency(Math.abs(r.amount))}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>

                <div className="sticky bottom-20 mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/70 bg-card/95 p-4 shadow-lift backdrop-blur lg:bottom-4">
                  <div className="text-sm">
                    <p className="font-semibold">{included.length} lançamentos selecionados</p>
                    <p className="text-xs text-muted-foreground">
                      Entradas <span className="font-semibold text-success">{formatCurrency(totalIn)}</span> · Saídas <span className="font-semibold text-danger">{formatCurrency(totalOut)}</span>
                    </p>
                  </div>
                  <Button onClick={doImport} isLoading={busy} disabled={included.length === 0}>
                    Importar {included.length}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
