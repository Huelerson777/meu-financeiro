'use client';

import { notifyAlert, confirmDialog } from '@/utils/notify';
import { useEffect, useState } from 'react';
import { Target, Plus, Trash2, Pencil } from 'lucide-react';
import { api } from '@/services/api';
import { formatCurrency, formatCurrencyRound } from '@/utils/currency';
import { Ring } from '@/components/ui/ring';
import { Story, Dim } from '@/components/ui/story';
import { Money } from '@/components/dashboard/month-story';

interface Goal {
  id: string;
  name: string;
  targetAmount: number | string;
  currentAmount: number | string;
  deadline: string | null;
}

export default function GoalsPage() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [currentAmount, setCurrentAmount] = useState('');
  const [deadline, setDeadline] = useState('');

  const [contributeGoal, setContributeGoal] = useState<Goal | null>(null);
  const [contributeAmount, setContributeAmount] = useState('');
  const [contributing, setContributing] = useState(false);

  const extractList = (raw: any): Goal[] => {
    if (Array.isArray(raw)) return raw;
    if (Array.isArray(raw?.data)) return raw.data;
    return [];
  };

  const fetchGoals = async () => {
    try {
      const res = await api.get('/goals');
      setGoals(extractList(res.data));
    } catch {
      setGoals([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGoals();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleOpenCreate = () => {
    setEditingId(null);
    setName('');
    setTargetAmount('');
    setCurrentAmount('');
    setDeadline('');
    setIsModalOpen(true);
  };

  const handleEdit = (g: Goal) => {
    setEditingId(g.id);
    setName(g.name);
    setTargetAmount(g.targetAmount.toString());
    setCurrentAmount(g.currentAmount.toString());
    setDeadline(g.deadline ? g.deadline.split('T')[0] : '');
    setIsModalOpen(true);
  };

  const handleDelete = async (g: Goal) => {
    if (!(await confirmDialog(`Excluir a meta "${g.name}"?`))) return;
    try {
      await api.delete(`/goals/${g.id}`);
      fetchGoals();
    } catch {
      notifyAlert('Erro ao excluir meta.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const payload: any = {
        name,
        targetAmount: parseFloat(targetAmount || '0'),
        currentAmount: parseFloat(currentAmount || '0'),
      };
      if (deadline) payload.deadline = deadline;

      if (editingId) {
        await api.patch(`/goals/${editingId}`, payload);
      } else {
        await api.post('/goals', payload);
      }

      setIsModalOpen(false);
      fetchGoals();
    } catch (err: any) {
      const msg = err.response?.data?.message;
      notifyAlert(Array.isArray(msg) ? msg.join('\n') : msg || 'Erro ao salvar meta.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleContribute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contributeGoal) return;
    setContributing(true);
    try {
      await api.post(`/goals/${contributeGoal.id}/contribute`, {
        amount: parseFloat(contributeAmount || '0'),
      });
      setContributeGoal(null);
      setContributeAmount('');
      fetchGoals();
    } catch {
      notifyAlert('Erro ao adicionar valor.');
    } finally {
      setContributing(false);
    }
  };

  const daysUntil = (deadline: string | null) => {
    if (!deadline) return null;
    const diff = new Date(deadline).getTime() - new Date().setHours(0, 0, 0, 0);
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  return (
    <div>
      <div className="mb-4 flex items-end justify-between gap-4">
        <h1 className="font-display text-[1.7rem] font-bold leading-tight tracking-tight sm:text-3xl">Metas</h1>
        <button
          onClick={handleOpenCreate}
          className="btn-sheen inline-flex h-10 items-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-[inset_0_1px_0_hsl(0_0%_100%/0.18),0_6px_14px_-6px_hsl(var(--primary)/0.55)] transition-theme hover:-translate-y-px hover:brightness-110 active:scale-[0.97]"
        >
          <Plus className="h-4 w-4" /> Nova meta
        </button>
      </div>
      {!loading && goals.length > 0 && (() => {
        const saved = goals.reduce((s, g) => s + Number(g.currentAmount), 0);
        const target = goals.reduce((s, g) => s + Number(g.targetAmount), 0);
        const done = goals.filter((g) => Number(g.currentAmount) >= Number(g.targetAmount)).length;
        return (
          <Story className="mb-8 max-w-3xl">
            <Dim>Você já juntou</Dim> <Money value={saved} className="text-primary" /> <Dim>dos</Dim> <Money value={target} />{' '}
            <Dim>
              {goals.length === 1 ? 'da sua meta' : `das suas ${goals.length} metas`}
              {done > 0 ? ` — ${done} ${done === 1 ? 'concluída' : 'concluídas'}.` : '.'}
            </Dim>
          </Story>
        );
      })()}

      {loading ? (
        <div className="text-foreground py-8">Carregando...</div>
      ) : goals.length === 0 ? (
        <div className="rounded-[1.75rem] bg-foreground/[0.03] p-10 flex flex-col items-center text-center gap-3">
          <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
            <Target className="w-7 h-7 text-primary" />
          </div>
          <h2 className="text-lg font-semibold">Nenhuma meta cadastrada</h2>
          <p className="text-sm text-foreground max-w-md">
            Crie sua primeira meta, tipo &quot;Viagem&quot; ou &quot;Reserva de emergência&quot;, e acompanhe o progresso.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {goals.map((g) => {
            const target = Number(g.targetAmount);
            const current = Number(g.currentAmount);
            const pct = target > 0 ? Math.min((current / target) * 100, 100) : 0;
            const days = daysUntil(g.deadline);
            const isComplete = current >= target;

            return (
              <div key={g.id} className="group relative flex gap-4 rounded-[1.75rem] bg-foreground/[0.03] p-5 sm:p-6">
                <Ring value={pct / 100} size={72} thickness={6} color={isComplete ? 'hsl(var(--success))' : undefined} aria-label={`${pct.toFixed(0)}% da meta`}>
                  <span className="font-num text-base font-bold leading-none">{pct.toFixed(0)}%</span>
                </Ring>

                <div className="flex min-w-0 flex-1 flex-col">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-display min-w-0 break-words text-lg font-bold leading-tight tracking-tight">{g.name}</h3>
                    <div className="-mr-2 -mt-1 flex shrink-0 gap-0.5 transition-opacity focus-within:opacity-100 group-hover:opacity-100 [@media(hover:hover)]:opacity-0">
                      <button onClick={() => handleEdit(g)} aria-label={`Editar ${g.name}`} className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-theme hover:bg-primary/10 hover:text-primary">
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button onClick={() => handleDelete(g)} aria-label={`Excluir ${g.name}`} className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-theme hover:bg-danger/10 hover:text-danger">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <p className="mt-0.5 text-sm text-muted-foreground">
                    <span className="font-num font-semibold text-foreground">{formatCurrency(current)}</span> de {formatCurrency(target)}
                  </p>

                  {/* O que fazer para chegar: quanto por mês até o prazo */}
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                    {isComplete
                      ? 'Meta concluída.'
                      : g.deadline && days !== null && days > 0
                        ? (() => {
                            const months = Math.max(1, Math.ceil(days / 30));
                            return (
                              <>
                                Faltam <span className="font-num font-semibold text-foreground">{formatCurrencyRound(target - current)}</span>
                                {' · '}
                                <span className="font-semibold text-primary">{formatCurrencyRound((target - current) / months)}/mês</span> até{' '}
                                {new Date(g.deadline).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' }).replace('.', '')}
                              </>
                            );
                          })()
                        : g.deadline && days !== null && days <= 0
                          ? <span className="font-semibold text-warning">Prazo vencido · faltam {formatCurrencyRound(target - current)}</span>
                          : <>Faltam <span className="font-num font-semibold text-foreground">{formatCurrencyRound(target - current)}</span> · sem prazo</>}
                  </p>

                  {!isComplete && (
                    <button
                      onClick={() => setContributeGoal(g)}
                      className="mt-3 inline-flex h-9 w-fit items-center gap-1.5 rounded-full bg-primary/10 px-4 text-sm font-semibold text-primary transition-theme hover:bg-primary hover:text-primary-foreground active:scale-[0.98]"
                    >
                      <Plus className="h-4 w-4" /> Guardar
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Criar/Editar Meta */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-[2px] flex items-end justify-center z-50 sm:items-center sm:p-4">
        <div className="bg-card rounded-t-2xl sm:rounded-xl shadow-xl w-full max-w-md p-6 border border-border animate-rise max-h-[92dvh] overflow-y-auto sm:max-h-[90vh]">
            <div className="flex justify-between items-center mb-5">
              <h2 className="font-display text-xl font-bold tracking-tight">
                {editingId ? 'Editar Meta' : 'Nova Meta'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-foreground hover:text-foreground/80 font-bold text-lg">
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Nome da meta</label>
                <input
                  type="text" required placeholder="Ex: Viagem para a praia"
                  value={name} onChange={(e) => setName(e.target.value)}
                  className="w-full h-11 px-3 border border-input rounded-md bg-transparent focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Valor alvo (R$)</label>
                <input
                  type="number" step="0.01" required
                  value={targetAmount} onChange={(e) => setTargetAmount(e.target.value)}
                  className="w-full h-11 px-3 border border-input rounded-md bg-transparent focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Valor já guardado (R$)</label>
                <input
                  type="number" step="0.01"
                  value={currentAmount} onChange={(e) => setCurrentAmount(e.target.value)}
                  placeholder="0,00"
                  className="w-full h-11 px-3 border border-input rounded-md bg-transparent focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Prazo (opcional)</label>
                <input
                  type="date"
                  value={deadline} onChange={(e) => setDeadline(e.target.value)}
                  className="w-full h-11 px-3 border border-input rounded-md bg-transparent focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm text-foreground hover:underline">
                  Cancelar
                </button>
                <button
                  type="submit" disabled={isSubmitting}
                  className="bg-primary hover:brightness-110 hover:-translate-y-px active:scale-[0.97] btn-sheen text-primary-foreground px-5 py-2 rounded-md text-sm font-medium transition disabled:opacity-50"
                >
                  {isSubmitting ? 'Salvando...' : editingId ? 'Salvar Alterações' : 'Criar Meta'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Adicionar Valor */}
      {contributeGoal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-[2px] flex items-end justify-center z-50 sm:items-center sm:p-4">
        <div className="bg-card rounded-t-2xl sm:rounded-xl shadow-xl w-full max-w-sm p-6 border border-border animate-rise max-h-[92dvh] overflow-y-auto sm:max-h-[90vh]">
            <div className="flex justify-between items-center mb-1">
              <h2 className="font-display text-xl font-bold tracking-tight">Adicionar valor</h2>
              <button onClick={() => setContributeGoal(null)} className="text-foreground hover:text-foreground/80 font-bold text-lg">
                ✕
              </button>
            </div>
            <p className="text-sm text-foreground mb-5">
              Na meta <strong>{contributeGoal.name}</strong>
            </p>

            <form onSubmit={handleContribute} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Valor (R$)</label>
                <input
                  type="number" step="0.01" required autoFocus
                  value={contributeAmount} onChange={(e) => setContributeAmount(e.target.value)}
                  className="w-full h-11 px-3 border border-input rounded-md bg-transparent focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setContributeGoal(null)} className="px-4 py-2 text-sm text-foreground hover:underline">
                  Cancelar
                </button>
                <button
                  type="submit" disabled={contributing}
                  className="bg-primary hover:brightness-110 hover:-translate-y-px active:scale-[0.97] btn-sheen text-primary-foreground px-5 py-2 rounded-md text-sm font-medium transition disabled:opacity-50"
                >
                  {contributing ? 'Salvando...' : 'Adicionar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}