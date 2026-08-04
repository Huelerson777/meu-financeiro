/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // Ignora os avisos do ESLint durante o deploy na Vercel
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Ignora os erros de tipagem durante o deploy na Vercel
    ignoreBuildErrors: true,
  },
};

module.exports = nextConfig;