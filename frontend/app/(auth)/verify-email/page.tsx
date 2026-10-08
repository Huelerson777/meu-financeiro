'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { MailCheck } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmailCodeForm } from '@/components/auth/email-code-form';
import { useAuthStore } from '@/stores/auth-store';

function VerifyEmail() {
  const router = useRouter();
  const email = useSearchParams().get('email') ?? '';
  const setTokens = useAuthStore((s) => s.setTokens);

  if (!email) {
    return (
      <Card>
        <CardContent className="pt-6 text-center">
          <p className="text-sm text-muted-foreground">Não encontramos o e-mail a ser verificado.</p>
          <Link href="/login" className="mt-4 inline-block text-sm font-medium text-primary hover:underline">
            Voltar para o login
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="items-center text-center">
        <MailCheck className="mb-2 h-10 w-10 text-primary" />
        <CardTitle className="text-lg font-semibold text-foreground">Confirme seu e-mail</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="mb-5 text-center text-sm text-muted-foreground">
          Enviamos um código de 6 dígitos para <strong className="text-foreground">{email}</strong>. Ele expira em 15 minutos.
        </p>
        <EmailCodeForm
          email={email}
          startCooldown
          onVerified={({ accessToken, refreshToken }) => {
            setTokens(accessToken, refreshToken);
            toast.success('E-mail verificado! Bem-vindo(a) ao PouPay');
            router.push('/dashboard');
          }}
        />
        <Link href="/login" className="mt-6 block text-center text-sm text-muted-foreground hover:underline">
          Voltar para o login
        </Link>
      </CardContent>
    </Card>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense>
      <VerifyEmail />
    </Suspense>
  );
}
