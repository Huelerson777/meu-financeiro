import { BrandMark } from '@/components/layout/brand-mark';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-[100dvh] lg:grid-cols-[1.05fr_1fr]">
      {/* Painel de marca — só em telas grandes */}
      <aside className="relative hidden overflow-hidden bg-[hsl(163_72%_17%)] p-12 text-[hsl(42_45%_97%)] lg:flex lg:flex-col lg:justify-between">
        <div
          aria-hidden
          className="absolute -right-24 -top-24 h-[28rem] w-[28rem] rounded-full bg-[radial-gradient(circle,hsl(158_58%_52%/0.28),transparent_65%)]"
        />
        <div
          aria-hidden
          className="absolute -bottom-32 -left-20 h-[26rem] w-[26rem] rounded-full border border-[hsl(42_45%_97%)]/15"
        />
        <div className="relative flex items-center gap-2.5">
          <BrandMark className="[&_rect]:fill-[hsl(42_45%_97%)] [&_path]:stroke-[hsl(163_72%_17%)] [&_circle]:fill-[hsl(163_72%_17%)]" />
          <span className="font-display text-2xl font-bold tracking-tight">PouPay</span>
        </div>
        <div className="relative max-w-md">
          <h2 className="font-display text-5xl font-bold leading-[1.05] tracking-tight">
            Saiba quanto sobra antes de gastar.
          </h2>
          <p className="mt-5 text-lg leading-relaxed text-[hsl(42_45%_97%)]/75">
            Contas, cartões, investimentos e metas num lugar só — com leitura clara do que está acontecendo com o seu dinheiro.
          </p>
        </div>
        <p className="relative text-sm text-[hsl(42_45%_97%)]/55">Controle financeiro pessoal</p>
      </aside>

      <div className="flex items-center justify-center bg-background px-4 py-10">
        <div className="w-full max-w-sm animate-rise">
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <BrandMark />
            <span className="font-display text-xl font-bold tracking-tight">PouPay</span>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
