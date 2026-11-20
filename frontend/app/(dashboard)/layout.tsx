'use client';

import { Sidebar } from '@/components/layout/sidebar';
import { Topbar } from '@/components/layout/topbar';
import { MobileTabBar } from '@/components/layout/mobile-tab-bar';
import { AuthGuard } from '@/components/layout/auth-guard';
import { useValuesVisibilityStore } from '@/stores/values-visibility-store';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const hidden = useValuesVisibilityStore((s) => s.hidden);

  return (
    <AuthGuard>
      <div className="flex min-h-[100dvh]">
        <Sidebar />
        <div className="relative isolate flex min-w-0 flex-1 flex-col">
          {/* Luz ambiente estática no topo (gradiente puro, sem blur) */}
          <div aria-hidden className="canvas-glow pointer-events-none absolute inset-x-0 top-0 -z-10 h-[26rem] print:hidden" />
          <Topbar />
          {/* A key força remontar o conteúdo ao ligar/desligar "ocultar
              valores" — como formatCurrency lê o estado direto do store
              (fora de React), isso garante que todo valor já renderizado
              seja recalculado com a máscara certa. */}
          <main key={hidden ? 'hidden' : 'visible'} className="flex-1 overflow-y-auto print:overflow-visible print:p-0 px-4 pb-28 pt-2 sm:px-6 sm:pt-3 lg:px-8 lg:pb-10 mx-auto w-full max-w-[1320px]">
            {children}
          </main>
          {/* A barra fica DENTRO deste container "isolate": ele cria um
              contexto de empilhamento próprio, e os modais das telas (z-50)
              moram aqui dentro. Com a barra fora, o z-40 dela competia no
              nível de cima e ela cobria o rodapé de todo modal no celular
              (ex.: o botão de pagar da fatura). */}
          <MobileTabBar />
        </div>
      </div>
    </AuthGuard>
  );
}
