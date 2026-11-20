import Link from 'next/link';
import {
  ArrowRight,
  CalendarClock,
  ChevronDown,
  Eye,
  KeyRound,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  Target,
  Trash2,
  Wallet,
} from 'lucide-react';
import { BrandMark } from '@/components/layout/brand-mark';
import { PhoneDemo } from './phone-demo';

/*
 * Página de apresentação do PouPay (rota "/" para quem não está logado).
 * Tudo aqui é estático e renderizado no servidor — o FAQ usa <details>, sem
 * JavaScript. Os valores nos exemplos são ilustrativos.
 */

const ctaPrimary =
  'btn-sheen inline-flex items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-[0_10px_24px_-12px_hsl(var(--primary)/0.8)] transition-theme active:scale-[0.98]';
const ctaGhost =
  'inline-flex items-center justify-center rounded-full border border-border bg-card/60 px-6 py-3 text-sm font-semibold text-foreground transition-theme hover:bg-muted';

function CtaButton({ children = 'Criar conta grátis' }: { children?: React.ReactNode }) {
  return (
    <Link href="/register" className={ctaPrimary}>
      {children}
      <ArrowRight className="h-4 w-4" />
    </Link>
  );
}

/* ───────────────────────── Topo ───────────────────────── */

function Nav() {
  return (
    <header className="sticky top-3 z-40 px-3 sm:top-4 sm:px-6">
      <nav
        aria-label="Navegação da página"
        className="mx-auto flex max-w-5xl items-center justify-between gap-3 rounded-full border border-border/70 bg-card/80 py-2 pl-4 pr-2 shadow-soft backdrop-blur-md"
      >
        <Link href="/" className="flex items-center gap-2">
          <BrandMark className="h-7 w-7" />
          <span className="font-display text-lg font-bold tracking-tight">PouPay</span>
        </Link>
        <div className="flex items-center gap-1 sm:gap-2">
          <a href="#recursos" className="hidden rounded-full px-3 py-2 text-sm text-muted-foreground transition-theme hover:text-foreground md:block">
            Recursos
          </a>
          <a href="#seguranca" className="hidden rounded-full px-3 py-2 text-sm text-muted-foreground transition-theme hover:text-foreground md:block">
            Segurança
          </a>
          <a href="#duvidas" className="hidden rounded-full px-3 py-2 text-sm text-muted-foreground transition-theme hover:text-foreground md:block">
            Dúvidas
          </a>
          <Link href="/login" className="rounded-full px-3 py-2 text-sm font-semibold transition-theme hover:bg-muted sm:px-4">
            Entrar
          </Link>
          <Link
            href="/register"
            className="rounded-full bg-foreground px-4 py-2 text-sm font-semibold text-background transition-theme hover:opacity-90"
          >
            Criar conta
          </Link>
        </div>
      </nav>
    </header>
  );
}

function FloatCard({ className, children }: { className: string; children: React.ReactNode }) {
  return (
    <div
      aria-hidden
      className={`absolute hidden w-64 animate-rise rounded-2xl border border-border/70 bg-card/90 p-4 shadow-lift backdrop-blur lg:block ${className}`}
    >
      {children}
    </div>
  );
}

function Hero() {
  const week = [38, 62, 24, 80, 46, 0, 0];
  return (
    <section className="relative px-4 pb-16 pt-14 text-center sm:pt-20">
      <p className="mx-auto mb-5 inline-flex animate-rise items-center gap-2 rounded-full border border-border/70 bg-card/70 px-3 py-1 text-xs font-medium text-muted-foreground">
        <MessageCircle className="h-3.5 w-3.5 text-primary" />
        Lance gastos pelo WhatsApp
      </p>
      <h1 className="mx-auto max-w-3xl animate-rise font-display text-[2.6rem] font-bold leading-[1.02] tracking-tight sm:text-6xl">
        Conte o que gastou. <span className="block text-primary">O PouPay organiza o resto.</span>
      </h1>
      <p
        className="mx-auto mt-5 max-w-xl animate-rise text-base leading-relaxed text-muted-foreground sm:text-lg"
        style={{ animationDelay: '80ms' }}
      >
        Mande uma mensagem ou a foto do cupom e o lançamento aparece no painel, com categoria, valor e data. Contas,
        cartões, investimentos e metas num lugar só.
      </p>
      <div className="mt-8 flex animate-rise flex-col items-center justify-center gap-3 sm:flex-row" style={{ animationDelay: '160ms' }}>
        <CtaButton />
        <Link href="/login" className={ctaGhost}>
          Já tenho conta
        </Link>
      </div>

      <div className="relative mx-auto mt-14 max-w-5xl">
        <FloatCard className="left-0 top-24 text-left [animation-delay:500ms] xl:-left-6">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Últimos lançamentos</p>
          {[
            ['Almoço', 'Alimentação · hoje', 'R$ 32,90'],
            ['Mercado', 'Cartão · hoje', 'R$ 187,45'],
            ['Combustível', 'Transporte · ontem', 'R$ 210,00'],
          ].map(([title, meta, amount]) => (
            <div key={title} className="flex items-center justify-between gap-3 border-b border-border/60 py-2 last:border-0">
              <div>
                <p className="text-sm font-semibold">{title}</p>
                <p className="text-xs text-muted-foreground">{meta}</p>
              </div>
              <span className="font-num text-sm font-semibold">{amount}</span>
            </div>
          ))}
        </FloatCard>

        <FloatCard className="right-0 top-40 text-left [animation-delay:800ms] xl:-right-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Livre para gastar</p>
          <p className="mt-1 font-num text-2xl font-bold">R$ 1.860,00</p>
          <p className="text-xs text-muted-foreground">até o fim do mês</p>
          <div className="mt-4 flex h-16 items-end gap-2">
            {week.map((h, i) => (
              <div key={i} className="flex h-full flex-1 flex-col justify-end">
                <div
                  className={`w-full rounded-md ${h ? 'bg-primary/80' : 'border border-dashed border-border'}`}
                  style={{ height: `${Math.max(h, 14)}%` }}
                />
              </div>
            ))}
          </div>
          <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
            {['S', 'T', 'Q', 'Q', 'S', 'S', 'D'].map((d, i) => (
              <span key={i} className="flex-1 text-center">
                {d}
              </span>
            ))}
          </div>
        </FloatCard>

        <div className="animate-rise" style={{ animationDelay: '240ms' }}>
          <PhoneDemo />
        </div>
      </div>
    </section>
  );
}

function Highlights() {
  const items = [
    ['WhatsApp', 'Lance por texto ou foto'],
    ['Open Finance', 'Importação automática'],
    ['Claude', 'Integração via MCP'],
    ['No celular', 'Instala como app'],
  ];
  return (
    <section aria-label="Destaques" className="border-y border-border/70 bg-card/40">
      <div className="mx-auto grid max-w-5xl grid-cols-2 gap-y-6 px-4 py-8 sm:grid-cols-4">
        {items.map(([title, sub]) => (
          <div key={title} className="text-center">
            <p className="font-display text-xl font-bold tracking-tight sm:text-2xl">{title}</p>
            <p className="mt-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{sub}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ───────────────────────── Recursos ───────────────────────── */

function SectionTitle({ title, sub }: { title: React.ReactNode; sub: string }) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <h2 className="font-display text-3xl font-bold tracking-tight sm:text-5xl">{title}</h2>
      <p className="mt-4 text-base text-muted-foreground sm:text-lg">{sub}</p>
    </div>
  );
}

function Features() {
  const features = [
    {
      icon: MessageCircle,
      title: 'Lançamento por conversa',
      text: '“Uber 23 no crédito”, “mercado 180”. Escreva do seu jeito no WhatsApp ou mande a foto do cupom: a IA entende e lança.',
    },
    {
      icon: Wallet,
      title: 'Tudo num lugar só',
      text: 'Contas, cartões, faturas e investimentos juntos, com transferências entre contas e saldos sempre em dia.',
    },
    {
      icon: CalendarClock,
      title: 'Sabe o que vem pela frente',
      text: 'Parcelas, contas fixas e assinaturas do mês reunidas, com aviso antes de cada vencimento.',
    },
    {
      icon: Target,
      title: 'Metas com progresso visível',
      text: 'Juntando pra uma viagem ou pra reserva de emergência? Crie a meta e acompanhe quanto falta.',
    },
  ];
  return (
    <section id="recursos" className="scroll-mt-24 px-4 py-20 sm:py-28">
      <SectionTitle title="O que o PouPay faz por você" sub="Menos tempo anotando, mais clareza sobre o seu mês." />
      <div className="mx-auto mt-12 grid max-w-5xl gap-4 sm:grid-cols-2">
        {features.map(({ icon: Icon, title, text }) => (
          <div key={title} className="rounded-xl border border-border/70 bg-card p-6 shadow-soft transition-theme hover:-translate-y-0.5 sm:p-8">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Icon className="h-5 w-5" />
            </span>
            <h3 className="mt-5 font-display text-xl font-bold tracking-tight">{title}</h3>
            <p className="mt-2 leading-relaxed text-muted-foreground">{text}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function Showcase({
  title,
  text,
  visual,
  reverse,
}: {
  title: React.ReactNode;
  text: string;
  visual: React.ReactNode;
  reverse?: boolean;
}) {
  return (
    <section className="px-4 py-14 sm:py-20">
      <div className={`mx-auto flex max-w-5xl flex-col items-center gap-10 lg:gap-16 ${reverse ? 'lg:flex-row-reverse' : 'lg:flex-row'}`}>
        <div className="flex-1 text-center lg:text-left">
          <h2 className="font-display text-3xl font-bold leading-[1.05] tracking-tight sm:text-5xl">{title}</h2>
          <p className="mx-auto mt-5 max-w-md text-base leading-relaxed text-muted-foreground sm:text-lg lg:mx-0">{text}</p>
          <div className="mt-8">
            <CtaButton>Começar grátis</CtaButton>
          </div>
        </div>
        <div aria-hidden className="w-full max-w-md flex-1">
          {visual}
        </div>
      </div>
    </section>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl border border-border/70 bg-card p-5 shadow-lift sm:p-6">{children}</div>;
}

function InvoiceVisual() {
  const items = [
    { label: '3/10', name: 'Notebook', cat: 'Eletrônicos', amount: 'R$ 289,90', on: true },
    { label: '1/1', name: 'Farmácia', cat: 'Saúde', amount: 'R$ 64,30', on: true },
    { label: null, name: 'Streaming', cat: 'Assinatura', amount: 'R$ 39,90', on: false },
  ];
  return (
    <Panel>
      <div className="flex items-center justify-between">
        <p className="font-display text-lg font-bold">Cartão · Dezembro</p>
        <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">fecha dia 10</span>
      </div>
      <div className="mt-4">
        {items.map((it) => (
          <div key={it.name} className="flex items-center justify-between gap-3 border-b border-border/60 py-3 last:border-0">
            <div className="flex items-center gap-3">
              <span
                className={`flex h-5 w-5 items-center justify-center rounded-full border-2 ${it.on ? 'border-primary bg-primary text-primary-foreground' : 'border-input'}`}
              >
                {it.on && (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="h-3 w-3">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                )}
              </span>
              <div>
                <p className="text-sm font-medium">
                  {it.label && <span className="mr-1.5 font-semibold text-primary">{it.label}</span>}
                  {it.name}
                </p>
                <p className="text-xs text-muted-foreground">{it.cat}</p>
              </div>
            </div>
            <span className="font-num text-sm font-semibold">{it.amount}</span>
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-between gap-3 rounded-lg bg-primary/10 px-4 py-3">
        <span className="text-sm">
          2 selecionadas · <span className="whitespace-nowrap font-num font-semibold">R$ 354,20</span>
        </span>
        <span className="whitespace-nowrap rounded-lg bg-success px-3 py-1.5 text-xs font-semibold text-white">Pagar</span>
      </div>
    </Panel>
  );
}

function CategoriesVisual() {
  const cats = [
    ['Alimentação', 38, 'R$ 1.140'],
    ['Moradia', 27, 'R$ 810'],
    ['Transporte', 14, 'R$ 420'],
    ['Lazer', 11, 'R$ 330'],
    ['Outros', 10, 'R$ 300'],
  ] as const;
  return (
    <Panel>
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Gastos de novembro</p>
      <p className="mt-1 font-num text-3xl font-bold">R$ 3.000,00</p>
      <div className="mt-6 space-y-4">
        {cats.map(([name, pct, value], i) => (
          <div key={name}>
            <div className="mb-1.5 flex justify-between text-sm">
              <span className="font-medium">{name}</span>
              <span className="font-num text-muted-foreground">{value}</span>
            </div>
            <div className="h-2 rounded-full bg-muted">
              <div className="h-2 rounded-full bg-primary" style={{ width: `${(pct / 38) * 100}%`, opacity: 1 - i * 0.15 }} />
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function AssistantVisual() {
  return (
    <Panel>
      <div className="flex items-center gap-2 text-sm font-semibold">
        <Sparkles className="h-4 w-4 text-primary" /> Assistente
      </div>
      <div className="mt-5 flex flex-col gap-3 text-sm">
        <p className="self-end rounded-2xl rounded-br-md bg-muted px-4 py-2.5">quanto gastei com mercado este mês?</p>
        <p className="max-w-[90%] rounded-2xl rounded-bl-md border border-border/70 px-4 py-2.5 leading-relaxed">
          Foram <span className="font-num font-semibold">R$ 642,80</span> em 5 compras, a maior delas de{' '}
          <span className="font-num font-semibold">R$ 187,45</span> no cartão.
        </p>
        <p className="self-end rounded-2xl rounded-br-md bg-muted px-4 py-2.5">lança 45 de farmácia no cartão</p>
        <div className="max-w-[90%] rounded-2xl rounded-bl-md border border-border/70 px-4 py-3">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-primary">
            <ShieldCheck className="h-3.5 w-3.5" /> PouPay · lançamento criado
          </p>
          <p className="mt-1">
            Farmácia · Saúde · <span className="font-num font-semibold">R$ 45,00</span>
          </p>
        </div>
      </div>
    </Panel>
  );
}

/* ───────────────────────── Segurança ───────────────────────── */

function Security() {
  const items = [
    {
      icon: Eye,
      title: 'Só leitura',
      text: 'Ao conectar um banco, o PouPay importa as movimentações. Ele não faz Pix, pagamento nem transferência.',
    },
    {
      icon: KeyRound,
      title: 'A senha do banco fica com você',
      text: 'A conexão é feita via Open Finance e autorizada no ambiente do próprio banco. O PouPay não pede nem guarda essa senha.',
    },
    {
      icon: ShieldCheck,
      title: 'Conta protegida',
      text: 'Confirmação de e-mail no cadastro e saída automática da sessão depois de um tempo sem uso.',
    },
    {
      icon: Trash2,
      title: 'Seus dados, sua decisão',
      text: 'Exclua sua conta quando quiser, direto nas Configurações. Os dados vão embora junto.',
    },
  ];
  return (
    <section id="seguranca" className="scroll-mt-24 px-3 py-10 sm:px-6">
      <div className="relative mx-auto max-w-6xl overflow-hidden rounded-[2rem] bg-[hsl(163_72%_15%)] px-5 py-16 text-[hsl(42_45%_97%)] sm:px-12 sm:py-20">
        <div
          aria-hidden
          className="absolute -right-32 -top-32 h-[30rem] w-[30rem] rounded-full bg-[radial-gradient(circle,hsl(158_58%_52%/0.25),transparent_65%)]"
        />
        <div className="relative mx-auto max-w-2xl text-center">
          <h2 className="font-display text-3xl font-bold tracking-tight sm:text-5xl">O PouPay nunca mexe no seu dinheiro</h2>
          <p className="mt-4 text-base text-[hsl(42_45%_97%)]/75 sm:text-lg">
            Ele registra e organiza. Pagamentos e transferências continuam no app do seu banco.
          </p>
        </div>
        <div className="relative mx-auto mt-12 grid max-w-4xl gap-4 sm:grid-cols-2">
          {items.map(({ icon: Icon, title, text }) => (
            <div key={title} className="rounded-xl border border-white/10 bg-white/[0.04] p-6">
              <Icon className="h-5 w-5 text-[hsl(158_58%_60%)]" />
              <h3 className="mt-4 font-display text-lg font-bold">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[hsl(42_45%_97%)]/70">{text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ───────────────────────── Dúvidas ───────────────────────── */

const faq = [
  ['O PouPay é pago?', 'Não. Criar a conta e usar o PouPay é grátis.'],
  [
    'Preciso conectar meu banco?',
    'Não. Você pode lançar tudo à mão, por mensagem no WhatsApp ou pelo Claude. Conectar via Open Finance é opcional e serve para importar as movimentações automaticamente.',
  ],
  [
    'Como lanço um gasto pelo WhatsApp?',
    'Cadastre seu número em Configurações e mande uma mensagem como “almoço 32 no débito”, ou a foto do cupom. A IA interpreta e cria o lançamento com categoria, valor e data.',
  ],
  [
    'O PouPay pode movimentar meu dinheiro?',
    'Não. Ele só registra e organiza suas finanças. Nenhum Pix, pagamento ou transferência sai do PouPay.',
  ],
  [
    'Tem app para celular?',
    'O PouPay funciona no navegador e pode ser instalado na tela inicial do celular como um app, sem passar por loja. No iPhone: Compartilhar → Adicionar à Tela de Início. No Android: menu do navegador → Instalar app.',
  ],
  [
    'Como uso o PouPay com o Claude?',
    'O PouPay tem um conector MCP: adicione-o no Claude, autorize com a sua conta e peça lançamentos e consultas conversando.',
  ],
  ['Como excluo minha conta?', 'Em Configurações → Excluir conta. É definitivo: seus dados são apagados.'],
];

function Faq() {
  return (
    <section id="duvidas" className="scroll-mt-24 px-4 py-20 sm:py-28">
      <SectionTitle title="Dúvidas? A gente responde" sub="As perguntas mais comuns sobre o PouPay." />
      <div className="mx-auto mt-12 max-w-2xl">
        {faq.map(([q, a]) => (
          <details key={q} className="group border-b border-border/70 py-1">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 text-left font-semibold [&::-webkit-details-marker]:hidden">
              {q}
              <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
            </summary>
            <p className="pb-5 leading-relaxed text-muted-foreground">{a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

/* ───────────────────────── Fechamento ───────────────────────── */

function FinalCta() {
  return (
    <section className="px-4 pb-20 text-center">
      <h2 className="mx-auto max-w-2xl font-display text-3xl font-bold leading-[1.05] tracking-tight sm:text-5xl">
        Pronto pra saber quanto sobra no fim do mês?
      </h2>
      <p className="mt-4 text-base text-muted-foreground sm:text-lg">Crie sua conta e faça o primeiro lançamento hoje.</p>
      <div className="mt-8">
        <CtaButton />
      </div>
      <p className="mt-5 text-sm text-muted-foreground">Grátis · Funciona no celular · Lance pelo WhatsApp</p>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border/70 px-4 py-8">
      <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-4 text-sm text-muted-foreground sm:flex-row">
        <div className="flex items-center gap-2 text-foreground">
          <BrandMark className="h-6 w-6" />
          <span className="font-display font-bold">PouPay</span>
          <span className="text-muted-foreground">· Gestão financeira pessoal</span>
        </div>
        <div className="flex gap-5">
          <Link href="/login" className="hover:text-foreground">
            Entrar
          </Link>
          <Link href="/register" className="hover:text-foreground">
            Criar conta
          </Link>
        </div>
      </div>
    </footer>
  );
}

export function LandingPage() {
  return (
    <div className="relative isolate min-h-[100dvh] overflow-x-clip">
      <div aria-hidden className="canvas-glow pointer-events-none absolute inset-x-0 top-0 -z-10 h-[40rem]" />
      <Nav />
      <main>
        <Hero />
        <Highlights />
        <Features />
        <Showcase
          title={
            <>
              Fatura sem <span className="text-primary">surpresa</span>
            </>
          }
          text="Cada compra parcelada mostra em qual parcela está, a fatura fecha no dia certo e você paga tudo de uma vez ou só o que escolher."
          visual={<InvoiceVisual />}
        />
        <Showcase
          reverse
          title={
            <>
              Veja pra onde seu <span className="text-primary">dinheiro vai</span>
            </>
          }
          text="Gastos por categoria, fluxo de caixa do mês e relatórios para exportar. Sem abrir planilha nenhuma."
          visual={<CategoriesVisual />}
        />
        <Showcase
          title={
            <>
              Pergunte. <span className="text-primary">Ele responde.</span>
            </>
          }
          text="Conecte o PouPay ao Claude e peça do seu jeito: “quanto gastei com mercado este mês?” ou “lança 45 de farmácia no cartão”."
          visual={<AssistantVisual />}
        />
        <Security />
        <Faq />
        <FinalCta />
      </main>
      <Footer />
    </div>
  );
}
