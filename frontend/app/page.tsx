import type { Metadata } from 'next';
import { LandingPage } from '@/components/landing/landing-page';

// Quem já tem sessão nem chega aqui: o middleware manda "/" direto pro painel.
export const metadata: Metadata = {
  title: 'PouPay · Conte o que gastou, o PouPay organiza o resto',
  description:
    'Lance gastos por mensagem ou foto no WhatsApp e acompanhe contas, cartões, faturas, investimentos e metas num lugar só. Grátis.',
};

export default function RootPage() {
  return <LandingPage />;
}
