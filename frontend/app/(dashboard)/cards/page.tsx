'use client';

import { CardsView } from '@/components/cards/cards-view';

// Cartões em tela própria (antes era uma aba dentro de Contas): fatura,
// compras e parcelas ficam a um toque no menu e na barra do celular.
export default function CardsPage() {
  return (
    <div>
      <h1 className="font-display mb-6 text-[1.7rem] font-bold leading-tight tracking-tight sm:text-3xl">Cartões</h1>
      <CardsView />
    </div>
  );
}
