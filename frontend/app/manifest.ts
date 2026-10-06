import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'PouPay',
    short_name: 'PouPay',
    description: 'Controle suas contas, cartões, investimentos e metas em um só lugar.',
    start_url: '/dashboard',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#f8f6f1',
    theme_color: '#0f6149',
    lang: 'pt-BR',
    icons: [
      { src: '/pwa-icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/pwa-icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/pwa-icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: 'Transações', url: '/transactions' },
      { name: 'Projeção', url: '/projection' },
    ],
  };
}
