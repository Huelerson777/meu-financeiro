# Variáveis de Ambiente

## Backend (`backend/.env`)

| Variável | Descrição | Exemplo |
|---|---|---|
| `DATABASE_URL` | Connection string do PostgreSQL (Supabase em produção) | `postgresql://user:pass@host:5432/db?schema=public` |
| `JWT_SECRET` | Segredo para assinar o access token | string aleatória forte |
| `JWT_EXPIRES_IN` | Duração do access token | `15m` |
| `JWT_REFRESH_SECRET` | Segredo adicional reservado para uso futuro em estratégias de refresh assinado | string aleatória forte |
| `JWT_REFRESH_EXPIRES_IN` | Duração do refresh token | `7d` |
| `PORT` | Porta HTTP da API | `3001` |
| `NODE_ENV` | Ambiente de execução | `development` \| `production` |
| `FRONTEND_URL` | Origem permitida no CORS | `https://app.financeflow.com` |
| `THROTTLE_TTL` | Janela do rate limit (segundos) | `60` |
| `THROTTLE_LIMIT` | Máximo de requisições por janela | `100` |

Veja `backend/.env.example` para o arquivo pronto para copiar.

## Frontend (`frontend/.env.local`)

| Variável | Descrição | Exemplo |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | URL base da API (incluindo `/api`) | `http://localhost:3001/api` |

Veja `frontend/.env.example` para o arquivo pronto para copiar.

> Variáveis prefixadas com `NEXT_PUBLIC_` ficam expostas no bundle do navegador — nunca coloque segredos nelas.
