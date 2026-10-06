import type { Metadata } from 'next';
import { Bricolage_Grotesque, Figtree } from 'next/font/google';
import { Toaster } from 'sonner';
import { ThemeProvider } from '@/components/layout/theme-provider';
import { ConfirmHost } from '@/components/layout/confirm-host';
import { DevToolsGuard } from '@/components/layout/devtools-guard';
import { QueryProvider } from '@/providers/query-provider';
import './globals.css';

const display = Bricolage_Grotesque({ subsets: ['latin'], variable: '--font-display' });
const body = Figtree({ subsets: ['latin'], variable: '--font-body' });

export const metadata: Metadata = {
  title: 'PouPay',
  description: 'Controle suas contas, cartões, investimentos e metas em um só lugar.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${display.variable} ${body.variable}`} suppressHydrationWarning>
      <body className="font-sans">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <DevToolsGuard />
          <QueryProvider>
            {children}
            <ConfirmHost />
            <Toaster richColors position="top-center" toastOptions={{ className: 'font-sans' }} />
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
