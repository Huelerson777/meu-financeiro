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
| `WHATSAPP_ACCESS_TOKEN` | Token de acesso do app WhatsApp Cloud API (Meta for Developers) | gerado via "System User" |
| `WHATSAPP_PHONE_NUMBER_ID` | ID do número do WhatsApp associado ao app | painel do produto WhatsApp |
| `WHATSAPP_APP_SECRET` | App Secret (App Settings → Basic) — valida a assinatura HMAC dos webhooks | — |
| `WHATSAPP_VERIFY_TOKEN` | String qualquer escolhida por você, repetida na configuração do webhook no dashboard da Meta | string aleatória |
| `ANTHROPIC_API_KEY` | Chave da API da Anthropic, usada pra interpretar as mensagens/fotos do WhatsApp | console.anthropic.com |
| `ANTHROPIC_MODEL` | Modelo usado na interpretação (opcional, tem default) | `claude-haiku-4-5-20251001` |

Veja `backend/.env.example` para o arquivo pronto para copiar.

## Frontend (`frontend/.env.local`)

| Variável | Descrição | Exemplo |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | URL base da API (incluindo `/api`) | `http://localhost:3001/api` |

Veja `frontend/.env.example` para o arquivo pronto para copiar.

> Variáveis prefixadas com `NEXT_PUBLIC_` ficam expostas no bundle do navegador — nunca coloque segredos nelas.
