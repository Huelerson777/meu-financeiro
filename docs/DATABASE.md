# Banco de Dados

PostgreSQL, modelado via Prisma (`backend/prisma/schema.prisma`).

## Tabelas

| Tabela | Descrição |
|---|---|
| `users` | Contas de usuário, credenciais, papel (role) e plano |
| `sessions` | Sessões ativas (dispositivo/IP), usado para "controle de sessão" |
| `refresh_tokens` | Refresh tokens (hash), com revogação e expiração |
| `accounts` | Contas financeiras do usuário (corrente, poupança, carteira, dinheiro, investimento) |
| `transfers` | Transferências entre contas do próprio usuário |
| `categories` | Categorias de transação, com hierarquia pai/filho (`parent_id`) |
| `transactions` | Receitas e despesas, com status, recorrência e parcelamento |
| `installments` | Parcelas de uma transação parcelada |
| `cards` | Cartões de crédito: limite, fechamento, vencimento |
| `investments` | Ativos de investimento: quantidade, preço médio, preço atual |
| `goals` | Metas financeiras: valor alvo, valor atual, prazo |
| `budgets` | Orçamento por categoria/mês/ano |
| `notifications` | Notificações do usuário (contas a vencer, metas, etc.) |
| `settings` | Preferências do usuário (tema, idioma, moeda) |
| `logs` | Auditoria de ações sensíveis |

## Relacionamentos principais

- `User 1—N Account, Category, Transaction, Card, Investment, Goal, Budget, Notification, Session, RefreshToken`
- `Account 1—N Transaction` e `Account 1—N Transfer` (como origem e como destino, relações nomeadas `TransferFromAccount` / `TransferToAccount`)
- `Category 1—N Category` (auto-relacionamento para subcategorias via `parent_id`)
- `Transaction 1—N Installment` (parcelamento)
- `Transaction N—1 Card` (opcional — despesa lançada no cartão)
- `Budget` possui constraint única `(userId, categoryId, month, year)` — evita orçamento duplicado para o mesmo mês/categoria

## Índices

Todas as chaves estrangeiras usadas em filtros frequentes têm índice explícito (`@@index`), por exemplo: `transactions(userId)`, `transactions(accountId)`, `transactions(date)`, `transactions(status)`, `accounts(userId)`, `cards(userId)`. Isso garante que os filtros do dashboard e das listagens paginadas não façam full table scan à medida que os dados crescem.

## Tipos numéricos

Valores monetários usam `Decimal` (não `Float`), evitando erros de arredondamento em somas financeiras — crítico para um sistema financeiro. Quantidade de ativos de investimento usa `Decimal(18,8)` para suportar frações (ex.: criptoativos).

## Migrations e seed

```bash
npx prisma migrate dev --name init   # cria a primeira migration e aplica no banco
npx prisma db seed                   # popula um usuário de demonstração + dados de exemplo
npx prisma studio                    # inspeciona o banco visualmente
```

Em produção, use `npx prisma migrate deploy` (não `migrate dev`), que apenas aplica migrations já geradas sem prompts interativos.
