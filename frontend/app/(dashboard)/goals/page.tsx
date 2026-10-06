'use client';

import { notifyAlert, confirmDialog } from '@/utils/notify';
import { useEffect, useState } from 'react';
import { Target, Plus, Trash2, Pencil } from 'lucide-react';
import { api } from '@/services/api';
import { formatCurrency } from '@/utils/currency';

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
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Metas</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Defina objetivos financeiros e acompanhe o progresso.
          </p>
        </div>
        <button
          onClick={handleOpenCreate}
          className="bg-primary hover:brightness-110 active:scale-[0.97] text-primary-foreground px-4 py-2 rounded-md font-medium transition shadow flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> Nova Meta
        </button>
      </div>

      {loading ? (
        <div className="text-foreground py-8">Carregando...</div>
      ) : goals.length === 0 ? (
        <div className="bg-card rounded-xl shadow border border-border p-10 flex flex-col items-center text-center gap-3">
          <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
            <Target className="w-7 h-7 text-primary" />
          </div>
          <h2 className="text-lg font-semibold">Nenhuma meta cadastrada</h2>
          <p className="text-sm text-foreground max-w-md">
            Crie sua primeira meta, tipo &quot;Viagem&quot; ou &quot;Reserva de emergência&quot;, e acompanhe o progresso.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {goals.map((g) => {
            const target = Number(g.targetAmount);
            const current = Number(g.currentAmount);
            const pct = target > 0 ? Math.min((current / target) * 100, 100) : 0;
            const days = daysUntil(g.deadline);
            const isComplete = current >= target;

            return (
              <div
                key={g.id}
                className="bg-card rounded-xl shadow border border-border relative overflow-hidden group p-6"
              >
                <div
                  className="absolute top-0 left-0 right-0 h-1"
                  style={{ backgroundColor: isComplete ? '#16a34a' : '#3b82f6' }}
                />

                <div className="absolute top-4 right-4 flex gap-3 [@media(hover:hover)]:opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => handleEdit(g)} className="text-foreground hover:text-primary">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDelete(g)} className="text-foreground hover:text-danger">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <h3 className="text-lg font-bold flex items-center gap-2">
                  <Target className="w-5 h-5 text-primary" />
                  {g.name}
                </h3>

                {g.deadline && (
                  <p className="text-xs text-foreground mt-1">
                    {days !== null && days >= 0
                      ? `Faltam ${days} dia${days === 1 ? '' : 's'}`
                      : days !== null && days < 0
                      ? 'Prazo vencido'
                      : ''}
                    {' · '}
                    {new Date(g.deadline).toLocaleDateString('pt-BR')}
                  </p>
                )}

                <div className="mt-4">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-foreground">
                      {formatCurrency(current)} de {formatCurrency(target)}
                    </span>
                    <span className="font-semibold">{pct.toFixed(0)}%</span>
                  </div>
                  <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${pct}%`, backgroundColor: isComplete ? '#16a34a' : '#3b82f6' }}
                    />
                  </div>
                </div>

                {isComplete ? (
                  <p className="mt-4 text-center text-sm font-semibold text-success">
                    🎉 Meta concluída!
                  </p>
                ) : (
                  <button
                    onClick={() => setContributeGoal(g)}
                    className="mt-4 w-full bg-muted/60 hover:bg-muted text-sm font-medium py-2 rounded-lg transition"
                  >
                    + Adicionar valor
                  </button>
                )}
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
              <h2 className="text-xl font-bold">
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
                  className="w-full px-3 py-2 border border-input rounded-lg bg-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Valor alvo (R$)</label>
                <input
                  type="number" step="0.01" required
                  value={targetAmount} onChange={(e) => setTargetAmount(e.target.value)}
                  className="w-full px-3 py-2 border border-input rounded-lg bg-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Valor já guardado (R$)</label>
                <input
                  type="number" step="0.01"
                  value={currentAmount} onChange={(e) => setCurrentAmount(e.target.value)}
                  placeholder="0,00"
                  className="w-full px-3 py-2 border border-input rounded-lg bg-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Prazo (opcional)</label>
                <input
                  type="date"
                  value={deadline} onChange={(e) => setDeadline(e.target.value)}
                  className="w-full px-3 py-2 border border-input rounded-lg bg-transparent"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm text-foreground hover:underline">
                  Cancelar
                </button>
                <button
                  type="submit" disabled={isSubmitting}
                  className="bg-primary hover:brightness-110 active:scale-[0.97] text-primary-foreground px-5 py-2 rounded-md text-sm font-medium transition disabled:opacity-50"
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
              <h2 className="text-xl font-bold">Adicionar valor</h2>
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
                  className="w-full px-3 py-2 border border-input rounded-lg bg-transparent"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setContributeGoal(null)} className="px-4 py-2 text-sm text-foreground hover:underline">
                  Cancelar
                </button>
                <button
                  type="submit" disabled={contributing}
                  className="bg-primary hover:brightness-110 active:scale-[0.97] text-primary-foreground px-5 py-2 rounded-md text-sm font-medium transition disabled:opacity-50"
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