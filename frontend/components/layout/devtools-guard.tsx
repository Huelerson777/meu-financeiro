'use client';

import { useEffect } from 'react';

/**
 * Dificulta o acesso casual ao DevTools (F12, botão direito, atalhos de
 * inspeção) só como deterrente de UX para usuários leigos — isso NÃO é
 * segurança de verdade. Qualquer pessoa com um mínimo de conhecimento
 * contorna isso (menu do navegador, outro atalho, DevTools remoto).
 * Dados sensíveis nunca devem depender disto para ficarem protegidos —
 * a proteção real é o backend nunca mandar pro cliente o que ele não
 * deveria ver.
 */
export function DevToolsGuard() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;

    const blockContextMenu = (e: MouseEvent) => e.preventDefault();

    const blockDevToolsShortcuts = (e: KeyboardEvent) => {
      const key = e.key.toUpperCase();
      const isDevToolsShortcut =
        key === 'F12' ||
        (e.ctrlKey && e.shiftKey && ['I', 'J', 'C'].includes(key)) ||
        (e.ctrlKey && key === 'U');

      if (isDevToolsShortcut) e.preventDefault();
    };

    document.addEventListener('contextmenu', blockContextMenu);
    document.addEventListener('keydown', blockDevToolsShortcuts);

    return () => {
      document.removeEventListener('contextmenu', blockContextMenu);
      document.removeEventListener('keydown', blockDevToolsShortcuts);
    };
  }, []);

  return null;
}
