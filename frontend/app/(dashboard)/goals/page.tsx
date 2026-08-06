'use client';

import { Target } from 'lucide-react';

export default function GoalsPage() {
  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold dark:text-white">Metas</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 mb-8">
        Acompanhamento de objetivos financeiros.
      </p>

      <div className="bg-white dark:bg-zinc-900 rounded-xl shadow border border-gray-100 dark:border-zinc-800 p-10 flex flex-col items-center text-center gap-3">
        <div className="w-14 h-14 rounded-full bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center">
          <Target className="w-7 h-7 text-blue-600 dark:text-blue-400" />
        </div>
        <h2 className="text-lg font-semibold dark:text-white">Em construção 🚧</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md">
          Em breve você vai poder criar metas (ex: "Viagem", "Reserva de emergência"),
          definir um valor alvo e acompanhar o progresso automaticamente.
        </p>
      </div>
    </div>
  );
}
