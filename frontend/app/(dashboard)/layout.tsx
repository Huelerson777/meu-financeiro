'use client';

import { Sidebar } from '@/components/layout/sidebar';
import { Topbar } from '@/components/layout/topbar';
import { AuthGuard } from '@/components/layout/auth-guard';
import { useValuesVisibilityStore } from '@/stores/values-visibility-store';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const hidden = useValuesVisibilityStore((s) => s.hidden);

  return (
    <AuthGuard>
      <div className="flex min-h-screen">
        <Sidebar />
        <div className="flex flex-1 flex-col">
          <Topbar />
          {/* A key força remontar o conteúdo ao ligar/desligar "ocultar
              valores" — como formatCurrency lê o estado direto do store
              (fora de React), isso garante que todo valor já renderizado
              seja recalculado com a máscara certa. */}
          <main key={hidden ? 'hidden' : 'visible'} className="flex-1 overflow-y-auto p-6">
            {children}
          </main>
        </div>
      </div>
    </AuthGuard>
  );
}
