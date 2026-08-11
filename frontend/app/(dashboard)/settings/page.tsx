'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { User, Lock, Palette, AlertTriangle } from 'lucide-react';
import { api } from '@/services/api';
import { useAuthStore } from '@/stores/auth-store';

export default function SettingsPage() {
  const router = useRouter();
  const logout = useAuthStore((s) => s.logout);

  // Perfil
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
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

  useEffect(() => {
    api.get('/users/me').then((res) => {
      const user = res.data?.data ?? res.data;
      setName(user.name ?? '');
      setEmail(user.email ?? '');
    }).catch(() => {});

    api.get('/settings').then((res) => {
      const settings = res.data?.data ?? res.data;
      setTheme(settings.theme ?? 'system');
      setCurrency(settings.currency ?? 'BRL');
    }).catch(() => {});
  }, []);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileSaving(true);
    try {
      await api.patch('/users/me', { name, email });
      alert('Perfil atualizado com sucesso!');
    } catch (err: any) {
      const msg = err.response?.data?.message;
      alert(Array.isArray(msg) ? msg.join('\n') : msg || 'Erro ao atualizar perfil.');
    } finally {
      setProfileSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordSaving(true);
    try {
      await api.patch('/users/me/password', { currentPassword, newPassword });
      alert('Senha alterada com sucesso!');
      setCurrentPassword('');
      setNewPassword('');
    } catch (err: any) {
      const msg = err.response?.data?.message;
      alert(Array.isArray(msg) ? msg.join('\n') : msg || 'Erro ao trocar senha.');
    } finally {
      setPasswordSaving(false);
    }
  };

  const handleSavePreferences = async (e: React.FormEvent) => {
    e.preventDefault();
    setPrefsSaving(true);
    try {
      await api.patch('/settings', { theme, currency });
      alert('Preferências salvas!');
    } catch (err: any) {
      alert('Erro ao salvar preferências.');
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
      alert('Erro ao excluir conta.');
      setDeleting(false);
    }
  };

  return (
    <div className="p-8 max-w-3xl">
      <h1 className="text-3xl font-bold dark:text-white">Configurações</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 mb-8">
        Gerencie seu perfil e preferências do sistema.
      </p>

      <div className="flex flex-col gap-6">
        {/* Perfil */}
        <div className="bg-white dark:bg-zinc-900 rounded-xl shadow border border-gray-100 dark:border-zinc-800 p-6">
          <div className="flex items-center gap-2 mb-4">
            <User className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <h2 className="text-lg font-semibold dark:text-white">Perfil</h2>
          </div>
          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div>
              <label className="block text-sm font-medium dark:text-gray-300 mb-1">Nome</label>
              <input
                type="text" required value={name} onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-700 rounded-lg bg-transparent dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium dark:text-gray-300 mb-1">E-mail</label>
              <input
                type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-700 rounded-lg bg-transparent dark:text-white"
              />
            </div>
            <div className="flex justify-end">
              <button
                type="submit" disabled={profileSaving}
                className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50"
              >
                {profileSaving ? 'Salvando...' : 'Salvar Perfil'}
              </button>
            </div>
          </form>
        </div>

        {/* Trocar Senha */}
        <div className="bg-white dark:bg-zinc-900 rounded-xl shadow border border-gray-100 dark:border-zinc-800 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Lock className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <h2 className="text-lg font-semibold dark:text-white">Trocar Senha</h2>
          </div>
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div>
              <label className="block text-sm font-medium dark:text-gray-300 mb-1">Senha atual</label>
              <input
                type="password" required value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-700 rounded-lg bg-transparent dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium dark:text-gray-300 mb-1">Nova senha</label>
              <input
                type="password" required minLength={6} value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-700 rounded-lg bg-transparent dark:text-white"
              />
            </div>
            <div className="flex justify-end">
              <button
                type="submit" disabled={passwordSaving}
                className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50"
              >
                {passwordSaving ? 'Salvando...' : 'Trocar Senha'}
              </button>
            </div>
          </form>
        </div>

        {/* Preferências */}
        <div className="bg-white dark:bg-zinc-900 rounded-xl shadow border border-gray-100 dark:border-zinc-800 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Palette className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <h2 className="text-lg font-semibold dark:text-white">Preferências</h2>
          </div>
          <form onSubmit={handleSavePreferences} className="space-y-4">
            <div>
              <label className="block text-sm font-medium dark:text-gray-300 mb-1">Tema</label>
              <select
                value={theme} onChange={(e) => setTheme(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 dark:text-white"
              >
                <option value="system">Automático (segue o sistema)</option>
                <option value="light">Claro</option>
                <option value="dark">Escuro</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium dark:text-gray-300 mb-1">Moeda</label>
              <select
                value={currency} onChange={(e) => setCurrency(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 dark:text-white"
              >
                <option value="BRL">Real (R$)</option>
                <option value="USD">Dólar (US$)</option>
                <option value="EUR">Euro (€)</option>
              </select>
            </div>
            <div className="flex justify-end">
              <button
                type="submit" disabled={prefsSaving}
                className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50"
              >
                {prefsSaving ? 'Salvando...' : 'Salvar Preferências'}
              </button>
            </div>
          </form>
        </div>

        {/* Zona de Perigo */}
        <div className="bg-red-50 dark:bg-red-900/10 rounded-xl border border-red-200 dark:border-red-900/30 p-6">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
            <h2 className="text-lg font-semibold text-red-700 dark:text-red-400">Zona de Perigo</h2>
          </div>
          <p className="text-sm text-red-600/80 dark:text-red-400/70 mb-4">
            Excluir sua conta é uma ação irreversível. Todos os seus dados (contas, transações, cartões, categorias) serão apagados.
          </p>

          {!showDeleteConfirm ? (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="bg-white dark:bg-transparent border border-red-300 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/20 px-5 py-2 rounded-lg text-sm font-medium transition"
            >
              Excluir minha conta
            </button>
          ) : (
            <div className="flex flex-col gap-3">
              <p className="text-sm font-semibold text-red-700 dark:text-red-400">
                Tem certeza? Essa ação não pode ser desfeita.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-4 py-2 text-sm text-gray-500 hover:underline"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleDeleteAccount}
                  disabled={deleting}
                  className="bg-red-600 hover:bg-red-700 text-white px-5 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50"
                >
                  {deleting ? 'Excluindo...' : 'Sim, excluir permanentemente'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}