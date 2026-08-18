# FinanceFlow — Sistema de Gestão Financeira (SaaS)

Sistema web de gestão financeira pessoal: contas, transações, cartões, investimentos, metas, orçamentos e relatórios, com dashboard em tempo real.

> **Status deste repositório:** fundação de produção real (backend + frontend + banco + auth funcionam de ponta a ponta), com o módulo **Accounts** implementado por completo como referência de padrão. Os demais módulos de domínio (`transactions`, `cards`, `investments`, `goals`, `budgets`, `reports`, `settings`, `notifications`) estão como esqueletos (`*.module.ts` / `*.controller.ts` / `*.service.ts`) prontos para receber a mesma implementação — ver `docs/ARCHITECTURE.md` → "Como implementar um novo módulo".

## Stack

| Camada     | Tecnologias |
|------------|-------------|
| Frontend   | Next.js (App Router), React, TypeScript, Tailwind CSS, shadcn/ui-style components, React Hook Form + Zod, TanStack Query, Zustand, Recharts, Axios |
| Backend    | NestJS, TypeScript, Prisma ORM, PostgreSQL |
| Auth       | JWT (access + refresh rotativo), bcrypt, Guards, Roles |
| Infra      | Vercel (frontend), Render (backend), Neon PostgreSQL |

## Estrutura

```
gestao-financeira-saas/
├── backend/           # API NestJS
│   ├── src/
│   │   ├── auth/          # JWT, refresh token, guards, strategies
│   │   ├── users/         # Perfil, troca de senha, exclusão de conta
│   │   ├── accounts/      # ✅ Módulo completo (referência de padrão)
│   │   ├── categories/    # Esqueleto
│   │   ├── transactions/  # Esqueleto
│   │   ├── cards/         # Esqueleto
│   │   ├── investments/   # Esqueleto
│   │   ├── goals/         # Esqueleto
│   │   ├── budgets/       # Esqueleto
│   │   ├── dashboard/     # ✅ Agregações reais para os cards e gráficos
│   │   ├── reports/       # Esqueleto
│   │   ├── settings/      # Esqueleto
│   │   ├── notifications/ # Esqueleto
│   │   └── common/        # Prisma service, filtros, interceptors, guards, DTOs
│   ├── prisma/
│   │   ├── schema.prisma  # Todas as tabelas, relacionamentos e índices
│   │   └── seed.ts
│   └── test/
├── frontend/          # App Next.js
│   ├── app/
│   │   ├── (auth)/login       # ✅ Página funcional
│   │   └── (dashboard)/dashboard  # ✅ Página funcional conectada à API
│   ├── components/{ui,layout,dashboard}
│   ├── hooks/  services/  stores/  types/  utils/
└── docs/              # Documentação detalhada
```

## Rodando localmente

**Backend**
```bash
cd backend
cp .env.example .env      # ajuste DATABASE_URL se necessário
npm install
npx prisma migrate dev --name init
npx prisma db seed
npm run start:dev
```

**Frontend**
```bash
cd frontend
cp .env.example .env.local
npm install
npm run dev
```

Login de demonstração (criado pelo seed): `demo@financeflow.com` / `123456`

## Documentação

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — arquitetura, padrões e como implementar um novo módulo
- [`docs/DATABASE.md`](docs/DATABASE.md) — modelagem do banco de dados
- [`docs/DEPLOY.md`](docs/DEPLOY.md) — deploy em Vercel + Render + Neon
- [`docs/ENVIRONMENT.md`](docs/ENVIRONMENT.md) — variáveis de ambiente

## Licença

Uso interno / privado do projeto.
