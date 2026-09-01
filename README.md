# FinanceFlow — Sistema de Gestão Financeira (SaaS)

Sistema web de gestão financeira pessoal: contas, transações, cartões, investimentos, metas, orçamentos e relatórios, com dashboard em tempo real.

> **Status deste repositório:** em produção real, de ponta a ponta (backend + frontend + banco + auth). A maioria dos módulos de domínio já está implementada — `accounts`, `categories`, `transactions`, `cards`, `investments`, `goals`, `dashboard`, `reports`, `settings`, `notifications`, `recurring-bills` e a integração `whatsapp` (lançamento de transações por mensagem, interpretado via Anthropic). Só `budgets` segue como esqueleto (`*.module.ts` / `*.controller.ts` / `*.service.ts`), pronto para receber a implementação — ver `docs/ARCHITECTURE.md` → "Como implementar um novo módulo".

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
│   │   ├── auth/            # JWT, refresh token, guards, strategies
│   │   ├── users/           # Perfil, troca de senha, exclusão de conta
│   │   ├── accounts/        # ✅ Contas e transferências entre contas
│   │   ├── categories/      # ✅ Categorias de transação
│   │   ├── transactions/    # ✅ Lançamentos (receita/despesa/transferência)
│   │   ├── cards/           # ✅ Cartões, faturas, parcelamento e pagamento em lote
│   │   ├── investments/     # ✅ Aportes e acompanhamento de investimentos
│   │   ├── goals/           # ✅ Metas financeiras com progresso
│   │   ├── budgets/         # Esqueleto — TODO
│   │   ├── dashboard/       # ✅ Agregações reais para os cards e gráficos
│   │   ├── reports/         # ✅ Fluxo de caixa, extrato, exportação
│   │   ├── settings/        # ✅ Preferências do usuário (tema, widgets do dashboard...)
│   │   ├── notifications/   # ✅ Central de notificações
│   │   ├── recurring-bills/ # ✅ Contas fixas recorrentes
│   │   ├── whatsapp/        # ✅ Lançamento de transações via WhatsApp (texto/foto, interpretado por IA)
│   │   └── common/          # Prisma service, filtros, interceptors, guards, DTOs
│   ├── prisma/
│   │   ├── schema.prisma  # Todas as tabelas, relacionamentos e índices
│   │   └── seed.ts
│   └── test/
├── frontend/          # App Next.js
│   ├── app/
│   │   ├── (auth)/         # login, registro, esqueci/redefinir senha
│   │   └── (dashboard)/    # dashboard, contas, transações, cartões,
│   │                       # investimentos, metas, contas fixas, relatórios, config
│   ├── middleware.ts       # roteamento de sessão no edge (ver docs/ARCHITECTURE.md)
│   ├── components/{ui,layout,dashboard,cards}
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

## Documentação

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — arquitetura, padrões e como implementar um novo módulo
- [`docs/DATABASE.md`](docs/DATABASE.md) — modelagem do banco de dados
- [`docs/DEPLOY.md`](docs/DEPLOY.md) — deploy em Vercel + Render + Neon
- [`docs/ENVIRONMENT.md`](docs/ENVIRONMENT.md) — variáveis de ambiente

## Licença

Uso interno / privado do projeto.
