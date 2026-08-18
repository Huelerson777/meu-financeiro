# Arquitetura

## Visão geral

```
┌─────────────┐      HTTPS/JSON       ┌──────────────┐      SQL       ┌──────────────┐
│   Next.js   │  ───────────────────▶ │    NestJS    │ ─────────────▶ │  PostgreSQL  │
│  (Vercel)   │ ◀─────────────────── │   (Render)   │ ◀───────────── │    (Neon)    │
└─────────────┘                       └──────────────┘                └──────────────┘
```

O frontend nunca acessa o banco diretamente — toda regra de negócio vive no backend. O frontend é responsável apenas por apresentação, estado de UI e cache de dados (TanStack Query).

## Backend — Clean Architecture em camadas

Cada módulo de domínio segue o mesmo fluxo de responsabilidade, sempre na mesma direção:

```
Controller → Service → Repository → PrismaService → PostgreSQL
   (HTTP)     (regras)   (acesso a dados)
```

- **Controller**: só lida com HTTP (rotas, status codes, Swagger). Não contém regra de negócio.
- **Service**: contém as regras de negócio (validações de domínio, autorização de posse de recurso, cálculos). Não conhece o Prisma diretamente.
- **Repository**: única camada que fala com o Prisma. Isola queries e facilita troca de ORM/banco no futuro.
- **DTOs** (`dto/*.ts`): contrato de entrada validado com `class-validator`. Nunca aceitar o `any` do body diretamente.

Essa separação está implementada de ponta a ponta no módulo `accounts/` — use-o como gabarito.

### Como implementar um novo módulo (ex.: `transactions`)

O esqueleto já existe em `backend/src/transactions/`. Para completá-lo:

1. **DTOs** (`transactions/dto/`): `create-transaction.dto.ts`, `update-transaction.dto.ts`, cada campo com decorators do `class-validator` (veja `accounts/dto/create-account.dto.ts` como exemplo).
2. **Repository** (`transactions.repository.ts`): métodos `create`, `findManyPaginated`, `findById`, `update`, `delete`, sempre recebendo `userId` e filtrando por ele (nunca confie em IDs vindos do client sem checar posse).
3. **Service** (`transactions.service.ts`): injete o repository, implemente as regras (ex.: transação parcelada gera N registros em `Installment`; transação recorrente agenda a próxima ocorrência). Lance `NotFoundException` / `ForbiddenException` / `BadRequestException` conforme o caso.
4. **Controller**: endpoints REST padrão (`POST /`, `GET /` paginado, `GET /:id`, `PATCH /:id`, `DELETE /:id`), protegidos com `@UseGuards(JwtAuthGuard)` e usando `@CurrentUser()` para obter o usuário autenticado.
5. **Module**: registre `Controller`, `Service` e `Repository` nos arrays `controllers`/`providers`.
6. **Testes**: replique `accounts/accounts.service.spec.ts` mockando o repository.

O padrão de paginação/pesquisa/ordenação já está pronto e reutilizável em `common/dto/pagination-query.dto.ts` — todo módulo de listagem deve usá-lo.

## Segurança implementada

- **Autenticação**: JWT de curta duração (access token, 15 min) + refresh token rotativo (hash SHA-256 armazenado no banco, nunca o token em texto puro). A cada uso, o refresh token antigo é revogado e um novo é emitido.
- **Senhas**: hash com bcrypt (10 rounds).
- **Autorização de recurso**: todo Service que manipula um recurso (`accounts`, e o mesmo padrão deve ser seguido nos demais) verifica se `resource.userId === user.id` antes de permitir leitura/escrita — previne IDOR.
- **Validação**: `ValidationPipe` global com `whitelist: true` e `forbidNonWhitelisted: true` — qualquer campo não declarado no DTO é rejeitado.
- **HTTP hardening**: Helmet (cabeçalhos de segurança) e CORS restrito à origem do frontend.
- **Rate limiting**: `@nestjs/throttler` configurado globalmente via variáveis de ambiente.
- **Padronização de erros**: `HttpExceptionFilter` global garante um formato único de erro em toda a API.

## Frontend — organização

- `app/`: rotas do App Router, agrupadas em `(auth)` (login/registro, layout sem sidebar) e `(dashboard)` (área logada, com sidebar + topbar).
- `components/ui/`: biblioteca de componentes própria (Button, Card, Input, Badge, Skeleton...), sem dependência de uma lib de UI externa fechada — fácil de estender.
- `services/`: uma função por chamada de API, sempre passando pela instância central `services/api.ts` (Axios com refresh automático de token em 401).
- `stores/`: estado global mínimo via Zustand (sessão/autenticação). Estado de servidor (dados remotos) vive no TanStack Query, não no Zustand.
- `hooks/`: um hook por recurso (`use-accounts`, `use-dashboard`), encapsulando a chamada TanStack Query — as páginas não chamam `services/` diretamente.

## Fluxo de autenticação (frontend ↔ backend)

1. Usuário envia e-mail/senha em `/login` → `POST /api/auth/login`.
2. Backend retorna `{ accessToken, refreshToken }`; frontend guarda em `useAuthStore` (persistido).
3. Toda requisição subsequente injeta `Authorization: Bearer <accessToken>` via interceptor do Axios.
4. Se a API responder 401 (token expirado), o interceptor chama `POST /api/auth/refresh` automaticamente, obtém um novo par de tokens e refaz a requisição original — o usuário não percebe a renovação.
5. Se o refresh também falhar (refresh token revogado/expirado), o usuário é deslogado (`useAuthStore.logout()`), enviando-o de volta ao login.

## Extensibilidade futura (sem reescrever a arquitetura)

- **Múltiplos usuários / famílias**: adicionar tabela `Workspace` e `WorkspaceMember`, com `workspaceId` nas tabelas de domínio no lugar de `userId` direto — os Repositories já isolam esse detalhe.
- **Planos Premium**: campo `plan` já existe em `User`; basta um `PremiumGuard` reutilizando o padrão do `RolesGuard`.
- **IA para classificação/insights**: novo módulo `ai/` que consome os dados via os Services existentes (não acessa o Prisma diretamente), preservando a camada de domínio.
- **Open Finance / OFX / CSV / PIX**: novos endpoints em `transactions/import/`, reaproveitando o `TransactionsService` para persistência.
