'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { authService } from '@/services/auth.service';

const RESEND_COOLDOWN_SECONDS = 60;

interface EmailCodeFormProps {
  email: string;
  /** Chamado com o resultado de /auth/verify-email (tokens) quando o código confere. */
  onVerified: (tokens: { accessToken: string; refreshToken: string }) => void | Promise<void>;
  /** Se o código acabou de ser enviado (cadastro/login), o reenvio já começa em espera. */
  startCooldown?: boolean;
}

/** Campo do código de 6 dígitos + reenvio com intervalo, reaproveitado na tela e no popup. */
export function EmailCodeForm({ email, onVerified, startCooldown = false }: EmailCodeFormProps) {
  const [code, setCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cooldown, setCooldown] = useState(startCooldown ? RESEND_COOLDOWN_SECONDS : 0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (code.length !== 6) return;
    setIsSubmitting(true);
    try {
      const tokens = await authService.verifyEmail(email, code);
      await onVerified(tokens);
    } catch (error: any) {
      const msg = error?.response?.data?.message;
      toast.error(Array.isArray(msg) ? msg.join('\n') : msg ?? 'Não foi possível verificar o código.');
      setCode('');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function resend() {
    setCooldown(RESEND_COOLDOWN_SECONDS);
    try {
      await authService.resendVerification(email);
      toast.success('Enviamos um novo código para o seu e-mail');
    } catch {
      toast.error('Não foi possível reenviar o código agora.');
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <Input
        inputMode="numeric"
        autoComplete="one-time-code"
        autoFocus
        maxLength={6}
        placeholder="000000"
        aria-label="Código de verificação"
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
        className="text-center font-mono text-2xl tracking-[0.5em]"
      />
      <Button type="submit" isLoading={isSubmitting} disabled={code.length !== 6} className="w-full">
        Verificar e-mail
      </Button>
      <button
        type="button"
        onClick={resend}
        disabled={cooldown > 0}
        className="text-sm font-medium text-primary hover:underline disabled:cursor-not-allowed disabled:text-muted-foreground disabled:no-underline"
      >
        {cooldown > 0 ? `Reenviar código em ${cooldown}s` : 'Reenviar código'}
      </button>
    </form>
  );
}
