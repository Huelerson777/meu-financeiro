'use client';

import { useState } from 'react';
import { MailWarning, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { EmailCodeForm } from '@/components/auth/email-code-form';
import { authService } from '@/services/auth.service';
import { useAuthStore } from '@/stores/auth-store';

/**
 * Popup mostrado ao entrar quando o e-mail da conta ainda não foi
 * confirmado (contas criadas antes da verificação existir, ou e-mail
 * trocado depois). Não bloqueia o uso: dá pra fechar com "Depois" — ele
 * volta a aparecer no próximo login/recarregamento.
 */
export function EmailVerificationPrompt() {
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const [dismissed, setDismissed] = useState(false);
  const [step, setStep] = useState<'notice' | 'code'>('notice');
  const [isSending, setIsSending] = useState(false);

  // `undefined` = perfil ainda não carregado; só `null` significa pendente.
  if (!user || user.emailVerifiedAt !== null || dismissed) return null;

  async function sendCode() {
    setIsSending(true);
    try {
      await authService.resendVerification(user!.email);
      setStep('code');
    } catch {
      toast.error('Não foi possível enviar o código agora. Tente novamente.');
    } finally {
      setIsSending(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="email-verification-title"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-[2px] sm:items-center sm:p-4"
    >
      <div className="w-full max-w-md animate-rise rounded-t-2xl border border-border bg-card p-6 shadow-xl sm:rounded-xl">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <MailWarning className="h-5 w-5" />
            </span>
            <h2 id="email-verification-title" className="font-display text-xl font-bold tracking-tight">
              Verifique seu e-mail
            </h2>
          </div>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            aria-label="Fechar"
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {step === 'notice' ? (
          <>
            <p className="text-sm text-muted-foreground">
              A verificação de <strong className="text-foreground">{user.email}</strong> ainda está pendente. Confirme
              com um código de 6 dígitos para manter sua conta ativa e segura.
            </p>
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="ghost" onClick={() => setDismissed(true)}>
                Depois
              </Button>
              <Button onClick={sendCode} isLoading={isSending}>
                Verificar agora
              </Button>
            </div>
          </>
        ) : (
          <>
            <p className="mb-5 text-sm text-muted-foreground">
              Enviamos um código para <strong className="text-foreground">{user.email}</strong>. Ele expira em 15 minutos.
            </p>
            <EmailCodeForm
              email={user.email}
              startCooldown
              onVerified={() => {
                setUser({ ...user, emailVerifiedAt: new Date().toISOString() });
                toast.success('E-mail verificado com sucesso');
              }}
            />
          </>
        )}
      </div>
    </div>
  );
}
