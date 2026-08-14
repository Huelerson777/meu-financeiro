'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { MailCheck } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { authService } from '@/services/auth.service';

const forgotSchema = z.object({
  email: z.string().email('Informe um e-mail válido'),
});

type ForgotForm = z.infer<typeof forgotSchema>;

export default function ForgotPasswordPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotForm>({ resolver: zodResolver(forgotSchema) });

  async function onSubmit(values: ForgotForm) {
    setIsSubmitting(true);
    try {
      await authService.forgotPassword(values.email);
    } finally {
      // Sempre mostra a mesma tela de sucesso, mesmo se o e-mail não existir
      // na base — evita que alguém use isso pra descobrir contas cadastradas.
      setIsSubmitting(false);
      setSent(true);
    }
  }

  if (sent) {
    return (
      <Card>
        <CardHeader className="items-center text-center">
          <MailCheck className="h-10 w-10 text-primary mb-2" />
          <CardTitle className="text-lg font-semibold text-foreground">Verifique seu e-mail</CardTitle>
        </CardHeader>
        <CardContent className="text-center">
          <p className="text-sm text-muted-foreground">
            Se esse e-mail estiver cadastrado, enviamos um link para redefinir sua senha. Ele expira em 1 hora.
          </p>
          <Link href="/login" className="mt-6 inline-block text-sm font-medium text-primary hover:underline">
            Voltar para o login
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-foreground">Recuperar senha</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground mb-4">
          Informe o e-mail da sua conta e enviaremos um link para redefinir sua senha.
        </p>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" type="email" placeholder="voce@email.com" {...register('email')} error={errors.email?.message} />
          </div>

          <Button type="submit" isLoading={isSubmitting} className="mt-2 w-full">
            Enviar link de recuperação
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Lembrou a senha?{' '}
          <Link href="/login" className="font-medium text-primary hover:underline">
            Voltar para o login
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
