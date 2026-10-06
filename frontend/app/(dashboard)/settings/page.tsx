'use client';

import { notifyAlert, confirmDialog } from '@/utils/notify';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { User, Lock, Palette, AlertTriangle, Tag } from 'lucide-react';
import { api } from '@/services/api';
import { useAuthStore } from '@/stores/auth-store';

interface CategoryItem {
  id: string;
  name: string;
  color: string;
  icon: string;
}

const extractList = (raw: any): CategoryItem[] => {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw.data)) return raw.data;
  if (Array.isArray(raw.items)) return raw.items;
  if (Array.isArray(raw.data?.items)) return raw.data.items;
  return [];
};

export default function SettingsPage() {
  const router = useRouter();
  const logout = useAuthStore((s) => s.logout);

  // Perfil
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);

  // Senha
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);

  // Preferências
  const [theme, setTheme] = useState('system');
  const [currency, setCurrency] = useState('BRL');
  const [prefsSaving, setPrefsSaving] = useState(false);

  // Excluir conta
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Categorias
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [categoryName, setCategoryName] = useState('');
  const [categoryColor, setCategoryColor] = useState('#3b82f6');
  const [categorySaving, setCategorySaving] = useState(false);

  const fetchCategories = () => {
    setCategoriesLoading(true);
    api.get('/categories').then((res) => {
      setCategories(extractList(res.data));
    }).catch(() => setCategories([])).finally(() => setCategoriesLoading(false));
  };

  useEffect(() => {
    api.get('/users/me').then((res) => {
      const user = res.data?.data ?? res.data;
      setName(user.name ?? '');
      setEmail(user.email ?? '');
      setWhatsappNumber(user.whatsappNumber ?? '');
    }).catch(() => {});

    api.get('/settings').then((res) => {
      const settings = res.data?.data ?? res.data;
      setTheme(settings.theme ?? 'system');
      setCurrency(settings.currency ?? 'BRL');
    }).catch(() => {});

    fetchCategories();
  }, []);

  const handleOpenCreateCategory = () => {
    setEditingCategoryId(null);
    setCategoryName('');
    setCategoryColor('#3b82f6');
    setIsCategoryModalOpen(true);
  };

  const handleOpenEditCategory = (cat: CategoryItem) => {
    setEditingCategoryId(cat.id);
    setCategoryName(cat.name);
    setCategoryColor(cat.color || '#3b82f6');
    setIsCategoryModalOpen(true);
  };

  const handleSubmitCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    setCategorySaving(true);
    try {
      const payload = { name: categoryName, color: categoryColor };
      if (editingCategoryId) {
        await api.patch(`/categories/${editingCategoryId}`, payload);
      } else {
        await api.post('/categories', payload);
      }
      setIsCategoryModalOpen(false);
      fetchCategories();
    } catch (err: any) {
      const msg = err.response?.data?.message;
      notifyAlert(Array.isArray(msg) ? msg.join('\n') : msg || 'Erro ao salvar categoria.');
    } finally {
      setCategorySaving(false);
    }
  };

  const handleDeleteCategory = async (cat: CategoryItem) => {
    if (!(await confirmDialog(`Excluir a categoria "${cat.name}"? Lançamentos que já usam ela mantêm o valor, só ficam sem categoria.`))) return;
    try {
      await api.delete(`/categories/${cat.id}`);
      fetchCategories();
    } catch {
      notifyAlert('Erro ao excluir a categoria.');
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileSaving(true);
    try {
      await api.patch('/users/me', { name, email, whatsappNumber: whatsappNumber || undefined });
      notifyAlert('Perfil atualizado com sucesso!');
    } catch (err: any) {
      const msg = err.response?.data?.message;
      notifyAlert(Array.isArray(msg) ? msg.join('\n') : msg || 'Erro ao atualizar perfil.');
    } finally {
      setProfileSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordSaving(true);
    try {
      await api.patch('/users/me/password', { currentPassword, newPassword });
      notifyAlert('Senha alterada com sucesso!');
      setCurrentPassword('');
      setNewPassword('');
    } catch (err: any) {
      const msg = err.response?.data?.message;
      notifyAlert(Array.isArray(msg) ? msg.join('\n') : msg || 'Erro ao trocar senha.');
    } finally {
      setPasswordSaving(false);
    }
  };

  const handleSavePreferences = async (e: React.FormEvent) => {
    e.preventDefault();
    setPrefsSaving(true);
    try {
      await api.patch('/settings', { theme, currency });
      notifyAlert('Preferências salvas!');
    } catch (err: any) {
      notifyAlert('Erro ao salvar preferências.');
    } finally {
      setPrefsSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    setDeleting(true);
    try {
      await api.delete('/users/me');
      logout();
      router.replace('/login');
    } catch (err: any) {
      notifyAlert('Erro ao excluir conta.');
      setDeleting(false);
    }
  };

  return (
    <div className="max-w-3xl">
      <h1 className="font-display text-3xl font-bold tracking-tight">Configurações</h1>
      <p className="text-sm text-muted-foreground mt-1 mb-8">
        Gerencie seu perfil e preferências do sistema.
      </p>

      <div className="flex flex-col gap-6">
        {/* Perfil */}
        <div className="bg-card rounded-xl shadow-soft border border-border/70 p-6">
          <div className="flex items-center gap-2 mb-4">
            <User className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold">Perfil</h2>
          </div>
          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Nome</label>
              <input
                type="text" required value={name} onChange={(e) => setName(e.target.value)}
                className="w-full h-11 px-3 border border-input rounded-md bg-transparent focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">E-mail</label>
              <input
                type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                className="w-full h-11 px-3 border border-input rounded-md bg-transparent focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                WhatsApp <span className="text-xs font-normal text-foreground">(pra lançar transações por mensagem)</span>
              </label>
              <input
                type="tel" placeholder="Ex: 5548999999999 (DDI+DDD+número, só dígitos)"
                value={whatsappNumber} onChange={(e) => setWhatsappNumber(e.target.value.replace(/\D/g, ''))}
                className="w-full h-11 px-3 border border-input rounded-md bg-transparent focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div className="flex justify-end">
              <button
                type="submit" disabled={profileSaving}
                className="bg-primary hover:brightness-110 hover:-translate-y-px active:scale-[0.97] btn-sheen text-primary-foreground px-5 py-2 rounded-md text-sm font-medium transition disabled:opacity-50"
              >
                {profileSaving ? 'Salvando...' : 'Salvar Perfil'}
              </button>
            </div>
          </form>
        </div>

        {/* Trocar Senha */}
        <div className="bg-card rounded-xl shadow-soft border border-border/70 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Lock className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold">Trocar Senha</h2>
          </div>
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Senha atual</label>
              <input
                type="password" autoComplete="current-password" required value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full h-11 px-3 border border-input rounded-md bg-transparent focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Nova senha</label>
              <input
                type="password" autoComplete="new-password" required minLength={6} value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                className="w-full h-11 px-3 border border-input rounded-md bg-transparent focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div className="flex justify-end">
              <button
                type="submit" disabled={passwordSaving}
                className="bg-primary hover:brightness-110 hover:-translate-y-px active:scale-[0.97] btn-sheen text-primary-foreground px-5 py-2 rounded-md text-sm font-medium transition disabled:opacity-50"
              >
                {passwordSaving ? 'Salvando...' : 'Trocar Senha'}
              </button>
            </div>
          </form>
        </div>

        {/* Preferências */}
        <div className="bg-card rounded-xl shadow-soft border border-border/70 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Palette className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold">Preferências</h2>
          </div>
          <form onSubmit={handleSavePreferences} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Tema</label>
              <select
                value={theme} onChange={(e) => setTheme(e.target.value)}
                className="w-full h-11 px-3 border border-input rounded-md bg-card focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
              >
                <option value="system">Automático (segue o sistema)</option>
                <option value="light">Claro</option>
                <option value="dark">Escuro</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Moeda</label>
              <select
                value={currency} onChange={(e) => setCurrency(e.target.value)}
                className="w-full h-11 px-3 border border-input rounded-md bg-card focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
              >
                <option value="BRL">Real (R$)</option>
                <option value="USD">Dólar (US$)</option>
                <option value="EUR">Euro (€)</option>
              </select>
            </div>
            <div className="flex justify-end">
              <button
                type="submit" disabled={prefsSaving}
                className="bg-primary hover:brightness-110 hover:-translate-y-px active:scale-[0.97] btn-sheen text-primary-foreground px-5 py-2 rounded-md text-sm font-medium transition disabled:opacity-50"
              >
                {prefsSaving ? 'Salvando...' : 'Salvar Preferências'}
              </button>
            </div>
          </form>
        </div>

        {/* Categorias */}
        <div className="bg-card rounded-xl shadow-soft border border-border/70 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Tag className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-semibold">Categorias</h2>
            </div>
            <button
              onClick={handleOpenCreateCategory}
              className="bg-primary hover:brightness-110 hover:-translate-y-px active:scale-[0.97] btn-sheen text-primary-foreground px-4 py-2 rounded-md text-sm font-medium transition"
            >
              + Nova Categoria
            </button>
          </div>

          {categoriesLoading ? (
            <p className="text-sm text-foreground">Carregando...</p>
          ) : categories.length === 0 ? (
            <p className="text-sm text-foreground">Nenhuma categoria cadastrada ainda.</p>
          ) : (
            <ul className="divide-y divide-gray-100 dark:divide-zinc-800">
              {categories.map((cat) => (
                <li key={cat.id} className="flex items-center justify-between py-2.5 group">
                  <div className="flex items-center gap-3">
                    <span className="h-3.5 w-3.5 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                    <span className="text-sm font-medium">{cat.name}</span>
                  </div>
                  <div className="flex gap-3 [@media(hover:hover)]:opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => handleOpenEditCategory(cat)} className="text-sm font-medium text-primary hover:text-primary">
                      Editar
                    </button>
                    <button onClick={() => handleDeleteCategory(cat)} className="text-sm font-medium text-danger hover:text-danger">
                      Excluir
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Zona de Perigo */}
        <div className="bg-danger/10 rounded-xl border border-danger/30 p-6">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-5 h-5 text-danger" />
            <h2 className="text-lg font-semibold text-danger">Zona de Perigo</h2>
          </div>
          <p className="text-sm text-danger/80 mb-4">
            Excluir sua conta é uma ação irreversível. Todos os seus dados (contas, transações, cartões, categorias) serão apagados.
          </p>

          {!showDeleteConfirm ? (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="bg-card dark:bg-transparent border border-danger/30 text-danger hover:bg-danger/10 px-5 py-2 rounded-lg text-sm font-medium transition"
            >
              Excluir minha conta
            </button>
          ) : (
            <div className="flex flex-col gap-3">
              <p className="text-sm font-semibold text-danger">
                Tem certeza? Essa ação não pode ser desfeita.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-4 py-2 text-sm text-foreground hover:underline"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleDeleteAccount}
                  disabled={deleting}
                  className="bg-danger hover:brightness-110 text-white px-5 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50"
                >
                  {deleting ? 'Excluindo...' : 'Sim, excluir permanentemente'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {isCategoryModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-[2px] flex items-end justify-center z-50 sm:items-center sm:p-4">
        <div className="bg-card rounded-t-2xl sm:rounded-xl shadow-xl w-full max-w-sm p-6 border border-border animate-rise max-h-[92dvh] overflow-y-auto sm:max-h-[90vh]">
            <div className="flex justify-between items-center mb-5">
              <h2 className="font-display text-xl font-bold tracking-tight">
                {editingCategoryId ? 'Editar Categoria' : 'Nova Categoria'}
              </h2>
              <button onClick={() => setIsCategoryModalOpen(false)} className="text-foreground hover:text-foreground/80 font-bold text-lg">✕</button>
            </div>

            <form onSubmit={handleSubmitCategory} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Nome</label>
                <input
                  type="text" required minLength={2} placeholder="Ex: Educação, Pets, Viagem..."
                  value={categoryName} onChange={(e) => setCategoryName(e.target.value)}
                  className="w-full h-11 px-3 border border-input rounded-md bg-transparent focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Cor</label>
                <input
                  type="color"
                  value={categoryColor} onChange={(e) => setCategoryColor(e.target.value)}
                  className="w-full h-10 p-1 border border-input rounded-lg bg-transparent cursor-pointer"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3">
                <button type="button" onClick={() => setIsCategoryModalOpen(false)} className="px-4 py-2 text-sm text-foreground hover:underline">Cancelar</button>
                <button type="submit" disabled={categorySaving} className="px-5 py-2 rounded-md text-sm font-semibold text-primary-foreground shadow bg-primary hover:brightness-110 hover:-translate-y-px active:scale-[0.97] btn-sheen">
                  {categorySaving ? 'Salvando...' : 'Confirmar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}