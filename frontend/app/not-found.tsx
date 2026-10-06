import Link from 'next/link';
import { BrandMark } from '@/components/layout/brand-mark';

export default function NotFound() {
  return (
    <main className="flex min-h-[100dvh] flex-col items-center justify-center bg-background px-6 text-center">
      <BrandMark className="h-12 w-12" />
      <p className="font-display mt-8 text-7xl font-bold tracking-tight text-primary">404</p>
      <h1 className="font-display mt-2 text-2xl font-bold tracking-tight">Essa página não existe</h1>
      <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
        O endereço pode ter mudado ou nunca existiu. Volte para o início e continue de onde parou.
      </p>
      <Link
        href="/dashboard"
        className="mt-8 inline-flex h-11 items-center rounded-md bg-primary px-6 text-sm font-semibold text-primary-foreground shadow-[0_6px_14px_-6px_hsl(var(--primary)/0.55)] transition-theme hover:brightness-110 active:scale-[0.97]"
      >
        Ir para o início
      </Link>
    </main>
  );
}
