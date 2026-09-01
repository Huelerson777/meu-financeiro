'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Loader2, ArrowLeftRight, Landmark, CreditCard } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { api } from '@/services/api';
import { formatCurrency } from '@/utils/currency';

interface TransactionResult {
  id: string;
  description: string;
  amount: number;
  type: 'INCOME' | 'EXPENSE' | 'TRANSFER';
  date: string;
}

interface AccountResult {
  id: string;
  name: string;
  type: string;
}

interface CardResult {
  id: string;
  name: string;
}

function extractList(raw: any): any[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw.data)) return raw.data;
  if (Array.isArray(raw.items)) return raw.items;
  if (Array.isArray(raw.data?.items)) return raw.data.items;
  if (Array.isArray(raw.data?.data)) return raw.data.data;
  return [];
}

export function SearchBox() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [transactions, setTransactions] = useState<TransactionResult[]>([]);
  const [accounts, setAccounts] = useState<AccountResult[]>([]);
  const [cards, setCards] = useState<CardResult[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) {
      setTransactions([]);
      setAccounts([]);
      setCards([]);
      return;
    }

    const timeout = setTimeout(async () => {
      setLoading(true);
      try {
        const [transRes, accRes, cardRes] = await Promise.all([
          api.get('/transactions', { params: { search: term, limit: 5 } }).catch(() => ({ data: [] })),
          api.get('/accounts', { params: { search: term, limit: 5 } }).catch(() => ({ data: [] })),
          api.get('/cards').catch(() => ({ data: [] })),
        ]);

        setTransactions(extractList(transRes.data).slice(0, 5));
        setAccounts(extractList(accRes.data).slice(0, 5));
        setCards(
          extractList(cardRes.data)
            .filter((c: CardResult) => c.name.toLowerCase().includes(term.toLowerCase()))
            .slice(0, 5),
        );
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timeout);
  }, [query]);

  const hasResults = transactions.length > 0 || accounts.length > 0 || cards.length > 0;
  const term = query.trim();

  const goTo = (path: string) => {
    setOpen(false);
    setQuery('');
    router.push(path);
  };

  return (
    <div className="relative w-full max-w-sm" ref={containerRef}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        placeholder="Pesquisar transações, contas, cartões..."
        className="pl-9"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
      />

      {open && term.length >= 2 && (
        <div className="absolute left-0 right-0 z-40 mt-2 max-h-96 overflow-y-auto rounded-lg border border-border bg-card shadow-lg">
          {loading ? (
            <div className="flex items-center justify-center gap-2 p-4 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Buscando...
            </div>
          ) : !hasResults ? (
            <p className="p-4 text-sm text-muted-foreground text-center">
              Nenhum resultado para &quot;{term}&quot;.
            </p>
          ) : (
            <div className="flex flex-col divide-y divide-border">
              {transactions.length > 0 && (
                <div className="p-2">
                  <p className="px-2 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Transações
                  </p>
                  {transactions.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => goTo('/transactions')}
                      className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-muted transition"
                    >
                      <ArrowLeftRight className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="flex-1 truncate">{t.description}</span>
                      <span className={t.type === 'INCOME' ? 'text-success' : t.type === 'EXPENSE' ? 'text-danger' : 'text-muted-foreground'}>
                        {formatCurrency(t.amount)}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {accounts.length > 0 && (
                <div className="p-2">
                  <p className="px-2 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Contas
                  </p>
                  {accounts.map((a) => (
                    <button
                      key={a.id}
                      onClick={() => goTo('/accounts')}
                      className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-muted transition"
                    >
                      <Landmark className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="truncate">{a.name}</span>
                    </button>
                  ))}
                </div>
              )}

              {cards.length > 0 && (
                <div className="p-2">
                  <p className="px-2 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Cartões
                  </p>
                  {cards.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => goTo('/cards')}
                      className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-muted transition"
                    >
                      <CreditCard className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="truncate">{c.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
