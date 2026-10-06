import { toast } from 'sonner';
import { create } from 'zustand';

/**
 * Substitui o `alert()` nativo: mensagens com "sucesso"/"salv" viram toast de
 * sucesso, o resto vira toast de erro. Quebras de linha viram " · ".
 */
export function notifyAlert(message: string) {
  const text = String(message).replace(/\n+/g, ' · ').replace(/^Erro (crítico|no servidor):\s*·?\s*/i, '');
  if (/sucesso|salv(a|o)s?!?$/i.test(text)) toast.success(text);
  else toast.error(text);
}

interface ConfirmState {
  open: boolean;
  message: string;
  destructive: boolean;
  resolve: ((value: boolean) => void) | null;
  ask: (message: string, destructive: boolean) => Promise<boolean>;
  answer: (value: boolean) => void;
}

export const useConfirmStore = create<ConfirmState>((set, get) => ({
  open: false,
  message: '',
  destructive: true,
  resolve: null,
  ask: (message, destructive) =>
    new Promise<boolean>((resolve) => {
      get().resolve?.(false);
      set({ open: true, message, destructive, resolve });
    }),
  answer: (value) => {
    get().resolve?.(value);
    set({ open: false, resolve: null });
  },
}));

/** Substitui `window.confirm()` — retorna uma Promise<boolean>. Use com `await`. */
export function confirmDialog(message: string, destructive?: boolean): Promise<boolean> {
  const isDestructive = destructive ?? /exclu|remov|apag|cancel|desfaz/i.test(message);
  return useConfirmStore.getState().ask(message, isDestructive);
}
