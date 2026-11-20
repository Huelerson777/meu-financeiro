import { Check, Mic, Receipt } from 'lucide-react';
import { BrandMark } from '@/components/layout/brand-mark';

/*
 * Celular do topo da página de apresentação: uma conversa de exemplo no
 * WhatsApp virando lançamento. As cores do aparelho são fixas (não seguem o
 * tema) pra ele parecer o mesmo objeto no claro e no escuro.
 */

const screen = 'bg-[hsl(165_24%_7%)] text-[hsl(40_25%_94%)]';
const bubbleIn = 'bg-[hsl(165_18%_13%)] text-[hsl(40_25%_94%)]';
const bubbleOut = 'bg-[hsl(158_58%_30%)] text-white';
const soft = 'text-[hsl(160_8%_62%)]';

function Bubble({ out, children, delay }: { out?: boolean; children: React.ReactNode; delay: number }) {
  return (
    <div
      className={`max-w-[84%] animate-rise rounded-2xl px-3 py-2 text-[12.5px] leading-snug ${out ? `self-end rounded-br-md ${bubbleOut}` : `self-start rounded-bl-md ${bubbleIn}`}`}
      style={{ animationDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

function Entry({ title, meta, amount }: { title: string; meta: string; amount: string }) {
  return (
    <div className="mt-1.5 flex items-center justify-between gap-3 rounded-xl bg-black/25 px-2.5 py-2">
      <div className="min-w-0">
        <p className="truncate font-semibold">{title}</p>
        <p className={`truncate text-[11px] ${soft}`}>{meta}</p>
      </div>
      <span className="whitespace-nowrap font-num font-semibold">{amount}</span>
    </div>
  );
}

export function PhoneDemo() {
  return (
    <div
      role="img"
      aria-label="Exemplo: uma mensagem no WhatsApp com o gasto vira um lançamento no PouPay, com categoria, valor e data."
      className="relative mx-auto w-[min(18.5rem,82vw)] text-left rounded-[2.9rem] border-[9px] border-[hsl(165_14%_16%)] bg-[hsl(165_14%_16%)] shadow-[0_40px_80px_-30px_hsl(165_60%_4%/0.55)]"
    >
      <div className={`flex h-[34rem] flex-col overflow-hidden rounded-[2.3rem] ${screen}`}>
        {/* Barra de status + ilha */}
        <div className="relative flex items-center justify-between px-6 pt-3 text-[11px] font-semibold">
          <span>9:41</span>
          <span className="absolute left-1/2 top-2 h-6 w-24 -translate-x-1/2 rounded-full bg-black" />
          <span className="flex items-center gap-1">
            <span className="h-2 w-3 rounded-[2px] bg-current opacity-80" />
            <span className="h-2.5 w-5 rounded-[3px] border border-current opacity-80" />
          </span>
        </div>

        {/* Cabeçalho da conversa */}
        <div className="mt-4 flex items-center gap-2.5 border-b border-white/5 px-4 pb-3">
          <BrandMark className="h-8 w-8 [&_rect]:fill-[hsl(158_58%_40%)] [&_path]:stroke-white [&_circle]:fill-white" />
          <div className="leading-tight">
            <p className="text-sm font-semibold">PouPay</p>
            <p className={`text-[11px] ${soft}`}>online</p>
          </div>
        </div>

        {/* Mensagens */}
        <div className="flex flex-1 flex-col justify-end gap-2 px-3 pb-3">
          <Bubble out delay={250}>almoço 32,90 no débito</Bubble>
          <Bubble delay={650}>
            <span className="flex items-center gap-1.5 font-semibold">
              <Check className="h-3.5 w-3.5 text-[hsl(158_58%_55%)]" /> Anotado
            </span>
            <Entry title="Almoço" meta="Alimentação · hoje" amount="R$ 32,90" />
          </Bubble>
          <Bubble out delay={1050}>
            <span className="flex items-center gap-2">
              <span className="flex h-9 w-8 items-center justify-center rounded-md bg-white/15">
                <Receipt className="h-4 w-4" />
              </span>
              <span>foto do cupom do mercado</span>
            </span>
          </Bubble>
          <Bubble delay={1450}>
            <span className="flex items-center gap-1.5 font-semibold">
              <Check className="h-3.5 w-3.5 text-[hsl(158_58%_55%)]" /> Lancei no cartão
            </span>
            <Entry title="Mercado" meta="Fatura de dezembro" amount="R$ 187,45" />
          </Bubble>
        </div>

        {/* Campo de mensagem */}
        <div className="flex items-center gap-2 px-3 pb-6">
          <div className={`flex-1 rounded-full px-4 py-2 text-[12px] ${bubbleIn} ${soft}`}>Mensagem</div>
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[hsl(158_58%_40%)] text-white">
            <Mic className="h-4 w-4" />
          </span>
        </div>
      </div>
    </div>
  );
}
