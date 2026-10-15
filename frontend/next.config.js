/** @type {import('next').NextConfig} */
const isDev = process.env.NODE_ENV !== 'production';

// Origem da API (NEXT_PUBLIC_API_URL é resolvida em build) — única origem
// externa permitida em connect-src. Next injeta scripts inline de hidratação,
// então script-src precisa de 'unsafe-inline' (sem nonce); 'unsafe-eval' só
// em dev (HMR/React Refresh).
const apiOrigin = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api').origin;
  } catch {
    return '';
  }
})();

const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src 'self' ${apiOrigin}${isDev ? ' ws:' : ''}`.trim(),
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
];

// Proxy da API sob a mesma origem do site: com NEXT_PUBLIC_API_URL=/api-proxy e
// API_PROXY_TARGET apontando pro backend, o cookie httpOnly do refresh token
// vira first-party (sem isso, Safari/Brave bloqueiam cookie de terceiro).
const proxyTarget = (process.env.API_PROXY_TARGET ?? '').replace(/\/+$/, '');

const nextConfig = {
  poweredByHeader: false,
  async rewrites() {
    if (!proxyTarget) return [];
    return [{ source: '/api-proxy/:path*', destination: `${proxyTarget}/api/:path*` }];
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

module.exports = nextConfig;
