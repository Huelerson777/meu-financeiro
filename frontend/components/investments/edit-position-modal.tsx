'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { investmentsService, InvestmentPosition } from '@/services/investments.service';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const selectClass =
  'h-10 w-full rounded-md border border-border bg-background px-3 text-sm transition-theme focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary';

interface EditPositionModalProps {
  position: InvestmentPosition | null;
  onClose: () => void;
  onSaved: () => void;
}

/**
 * Edita uma posição já registrada — inclusive quantidade e preço médio.
 * Zerar a quantidade marca a posição como vendida/encerrada sem excluir o
 * histórico (backend ajusta saldo/total investido pela diferença quando a
 * posição não tem transferência vinculada — ver InvestmentsService.updatePosition).
 */
export function EditPositionModal({ position, onClose, onSaved }: EditPositionModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [name, setName] = useState('');
  const [ticker, setTicker] = useState('');
  const [quantity, setQuantity] = useState('');
  const [averagePrice, setAveragePrice] = useState('');
  const [currentPrice, setCurrentPrice] = useState('');
  const [indexer, setIndexer] = useState<'CDI' | 'SELIC' | 'IPCA_PLUS' | 'PREFIXADO'>('CDI');
  const [rate, setRate] = useState('');
  const [startDate, setStartDate] = useState('');

  useEffect(() => {
    if (!position) return;
    setName(position.name);
    setTicker(position.ticker ?? '');
    setQuantity(String(position.quantity));
    setAveragePrice(String(position.averagePrice));
    setCurrentPrice(String(position.currentPrice));
    setIndexer(position.indexer ?? 'CDI');
    setRate(position.rate != null ? String(position.rate) : '');
    setStartDate(position.startDate ? position.startDate.split('T')[0] : '');
  }, [position]);

  if (!position) return null;

  const isStockLike = position.category === 'STOCK' || position.category === 'FUND';
  const isFixedIncome = position.category === 'FIXED_INCOME';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      alert('Dê um nome pro ativo.');
      return;
    }

    setIsSubmitting(true);
    try {
      await investmentsService.updatePosition(position.id, {
        name,
        quantity: parseFloat(quantity),
        averagePrice: parseFloat(averagePrice),
        currentPrice: currentPrice ? parseFloat(currentPrice) : undefined,
        ...(isStockLike ? { ticker: ticker || undefined } : {}),
        ...(isFixedIncome
          ? { indexer, rate: rate ? parseFloat(rate) : undefined, startDate: startDate || undefined }
          : {}),
      });
      onSaved();
      onClose();
    } catch (err: any) {
      const backendMessage = err.response?.data?.message;
      const formattedError = Array.isArray(backendMessage)
        ? backendMessage.join('\n• ')
        : backendMessage || err.message || 'Erro desconhecido ao editar a posição';
      alert(`Erro:\n• ${formattedError}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-card text-card-foreground rounded-xl shadow-xl w-full max-w-lg border border-border max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-4 px-6 py-5 border-b border-border">
          <div>
            <h2 className="text-lg font-semibold">Editar posição</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Zere a quantidade pra marcar como vendida — some do valor investido, mas o histórico continua registrado.
            </p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition shrink-0" aria-label="Fechar">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <Label>Nome do ativo</Label>
            <Input type="text" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>

          {isStockLike && (
            <div className="flex flex-col gap-1.5">
              <Label>Ticker (opcional)</Label>
              <Input type="text" value={ticker} onChange={(e) => setTicker(e.target.value.toUpperCase())} placeholder="Ex: PETR4" />
            </div>
          )}

          {isFixedIncome && (
            <div className="grid grid-cols-3 gap-3 bg-muted/50 p-3 rounded-lg border border-border">
              <div className="flex flex-col gap-1.5">
                <Label>Indexador</Label>
                <select className={selectClass} value={indexer} onChange={(e) => setIndexer(e.target.value as typeof indexer)}>
                  <option value="CDI">% do CDI</option>
                  <option value="SELIC">% da Selic</option>
                  <option value="IPCA_PLUS">IPCA + juros</option>
                  <option value="PREFIXADO">Prefixado</option>
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Taxa</Label>
                <Input type="number" step="0.01" value={rate} onChange={(e) => setRate(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Início do rendimento</Label>
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label>Quantidade</Label>
              <Input type="number" step="0.00000001" min="0" required value={quantity} onChange={(e) => setQuantity(e.target.value)} />
              <p className="text-xs text-muted-foreground">0 = vendida/encerrada</p>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Preço médio pago (R$)</Label>
              <Input type="number" step="0.01" min="0" required value={averagePrice} onChange={(e) => setAveragePrice(e.target.value)} />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Valor atual por unidade (R$)</Label>
            <Input type="number" step="0.01" min="0" value={currentPrice} onChange={(e) => setCurrentPrice(e.target.value)} />
            <p className="text-xs text-muted-foreground">
              Renda fixa e ações/fundos com ticker recalculam sozinhos ao abrir a tela — editar aqui só importa pras demais categorias.
            </p>
          </div>

          <div className="flex justify-end gap-3 pt-2 border-t border-border">
            <Button type="button" variant="ghost" onClick={onClose} className="mt-3">
              Cancelar
            </Button>
            <Button type="submit" isLoading={isSubmitting} className="mt-3">
              Salvar alterações
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
