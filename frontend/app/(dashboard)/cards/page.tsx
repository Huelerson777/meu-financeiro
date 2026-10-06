import { redirect } from 'next/navigation';

// Cartões agora é uma aba de "Contas e Cartões"; mantém links antigos funcionando.
export default function CardsRedirect() {
  redirect('/accounts?tab=cards');
}
