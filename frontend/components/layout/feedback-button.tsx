'use client';

import { useState } from 'react';
import { HelpCircle } from 'lucide-react';
import { api } from '@/services/api';

const SCREENS = [
  'Dashboard',
  'Contas',
  'Transações',
  'Contas Fixas',
  'Cartões',
  'Investimentos',
  'Metas',
  'Relatórios',
  'Configurações',
  'Outro',
];

export function FeedbackButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [screen, setScreen] = useState(SCREENS[0]);
  const [message, setMessage] = useState('');

  const handleOpen = () => {
    setScreen(SCREENS[0]);
    setMessage('');
    setSent(false);
    setIsOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await api.post('/feedback', { screen, message });
      setSent(true);
    } catch {
      alert('Erro ao enviar. Tenta de novo em alguns instantes.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <button
        onClick={handleOpen}
        title="Enviar feedback ou dúvida"
        aria-label="Enviar feedback ou dúvida"
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-theme"
      >
        <HelpCircle className="h-5 w-5" />
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-xl">
            {sent ? (
              <div className="text-center py-4">
                <p className="text-base font-semibold text-foreground">Feedback enviado, obrigado!</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Sua mensagem foi registrada e será analisada em breve.
                </p>
                <button
                  onClick={() => setIsOpen(false)}
                  className="mt-5 rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground shadow hover:opacity-90"
                >
                  Fechar
                </button>
              </div>
            ) : (
              <>
                <div className="mb-5 flex items-center justify-between">
                  <h2 className="text-xl font-bold text-foreground">Feedback ou dúvida</h2>
                  <button
                    onClick={() => setIsOpen(false)}
                    className="text-lg font-bold text-muted-foreground hover:text-foreground"
                  >
                    ✕
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-foreground">Sobre qual tela?</label>
                    <select
                      value={screen}
                      onChange={(e) => setScreen(e.target.value)}
                      className="w-full rounded-lg border border-border bg-transparent px-3 py-2 text-foreground"
                    >
                      {SCREENS.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-foreground">
                      Descreva o problema, dúvida ou sugestão
                    </label>
                    <textarea
                      required
                      minLength={5}
                      rows={4}
                      placeholder="Ex: erro no cadastro de conta — ao salvar, o saldo não aparece..."
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      className="w-full resize-none rounded-lg border border-border bg-transparent px-3 py-2 text-foreground"
                    />
                  </div>

                  <div className="flex justify-end gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setIsOpen(false)}
                      className="px-4 py-2 text-sm text-muted-foreground hover:underline"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground shadow hover:opacity-90"
                    >
                      {isSubmitting ? 'Enviando...' : 'Enviar'}
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
