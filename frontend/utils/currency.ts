import { useValuesVisibilityStore } from '@/stores/values-visibility-store';

// Máscara usada em todo o app quando o usuário ativa "ocultar valores" —
// mantém o símbolo da moeda pra não quebrar o layout, só troca os números.
function maskFor(currency: string) {
  const symbol =
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency })
      .formatToParts(0)
      .find((p) => p.type === 'currency')?.value ?? '';
  return `${symbol} ••••••`;
}

export function formatCurrency(value: number | string | null | undefined, currency: string = 'BRL') {
  if (useValuesVisibilityStore.getState().hidden) return maskFor(currency);
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency }).format(Number(value ?? 0));
}
