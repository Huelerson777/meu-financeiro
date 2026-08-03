import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

/**
 * Placeholder de UI. O fluxo de recuperação de senha (envio de e-mail com
 * token, endpoint POST /auth/forgot-password e /auth/reset-password) ainda
 * não foi implementado no backend — ver docs/ARCHITECTURE.md.
 */
export default function ForgotPasswordPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-foreground">Recuperar senha</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          Este fluxo ainda não foi implementado no backend. Volte para o{' '}
          <Link href="/login" className="font-medium text-primary hover:underline">
            login
          </Link>
          .
        </p>
      </CardContent>
    </Card>
  );
}
