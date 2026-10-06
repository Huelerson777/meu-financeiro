'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { CreditCard, Landmark } from 'lucide-react';
import { AccountsView } from '@/components/accounts/accounts-view';
import { CardsView } from '@/components/cards/cards-view';
import { cn } from '@/utils/cn';

type Tab = 'accounts' | 'cards';

const TABS: { key: Tab; label: string; icon: typeof Landmark }[] = [
  { key: 'accounts', label: 'Contas', icon: Landmark },
  { key: 'cards', label: 'Cartões', icon: CreditCard },
];

function AccountsAndCards() {
  const params = useSearchParams();
  const [tab, setTab] = useState<Tab>(params.get('tab') === 'cards' ? 'cards' : 'accounts');

  const select = (next: Tab) => {
    setTab(next);
    // mantém a aba na URL (link compartilhável / botão voltar) sem recarregar
    window.history.replaceState(null, '', next === 'cards' ? '/accounts?tab=cards' : '/accounts');
  };

  return (
    <div>
      <h1 className="font-display mb-5 text-3xl font-bold tracking-tight">Contas e Cartões</h1>

      <div role="tablist" className="mb-8 inline-flex rounded-xl bg-muted p-1">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            role="tab"
            aria-selected={tab === key}
            onClick={() => select(key)}
            className={cn(
              'flex items-center gap-2 rounded-lg px-5 py-2 text-sm font-semibold transition-theme active:scale-[0.97]',
              tab === key ? 'bg-card text-foreground shadow-soft' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Icon className="h-4 w-4" strokeWidth={1.75} />
            {label}
          </button>
        ))}
      </div>

      {tab === 'accounts' ? <AccountsView /> : <CardsView />}
    </div>
  );
}

export default function AccountsPage() {
  return (
    <Suspense fallback={null}>
      <AccountsAndCards />
    </Suspense>
  );
}
