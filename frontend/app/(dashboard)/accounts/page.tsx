'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AccountsView } from '@/components/accounts/accounts-view';

function AccountsPageContent() {
  const params = useSearchParams();
  const router = useRouter();
  const toCards = params.get('tab') === 'cards';

  // Cartões viraram uma tela própria (/cards); links antigos com ?tab=cards seguem funcionando
  useEffect(() => {
    if (toCards) router.replace('/cards');
  }, [toCards, router]);

  if (toCards) return null;

  return (
    <div>
      <h1 className="font-display mb-6 text-[1.7rem] font-bold leading-tight tracking-tight sm:text-3xl">Contas</h1>
      <AccountsView />
    </div>
  );
}

export default function AccountsPage() {
  return (
    <Suspense fallback={null}>
      <AccountsPageContent />
    </Suspense>
  );
}
