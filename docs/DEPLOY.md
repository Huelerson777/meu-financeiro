# Deploy em Produção

## Banco de Dados — Supabase PostgreSQL

1. Crie um projeto em https://supabase.com.
2. Copie a **Connection string** (modo "Transaction" para uso com pool, recomendado para serverless/Railway).
3. Use essa URL como `DATABASE_URL` no backend.
4. Rode as migrations contra o banco de produção uma única vez a partir de uma máquina com acesso:
   ```bash
   DATABASE_URL="<url-supabase>" npx prisma migrate deploy
   ```

## Backend — Railway

1. Crie um novo projeto no Railway e aponte para a pasta `backend/` do repositório (ou publique a imagem gerada pelo `backend/Dockerfile`).
2. Configure as variáveis de ambiente (ver `docs/ENVIRONMENT.md`), incluindo `DATABASE_URL` apontando para o Supabase.
3. Build command: `npm run build` · Start command: `npm run start:prod` (ou deixe o Dockerfile cuidar disso).
4. Após o primeiro deploy, rode `npx prisma migrate deploy` (pode ser um passo do pipeline de CI/CD ou um comando manual via Railway CLI).
5. Anote a URL pública gerada (ex.: `https://financeflow-api.up.railway.app`) — ela será usada como `NEXT_PUBLIC_API_URL` no frontend.

## Frontend — Vercel

1. Importe o repositório no Vercel, apontando o **Root Directory** para `frontend/`.
2. Configure a variável de ambiente `NEXT_PUBLIC_API_URL` com a URL pública do backend no Railway, seguida de `/api` (ex.: `https://financeflow-api.up.railway.app/api`).
3. Build command e output ficam nos defaults do Next.js (detectado automaticamente).
4. Cada push na branch principal gera um deploy automático.

## CORS

No backend, `FRONTEND_URL` deve apontar exatamente para o domínio do Vercel (incluindo `https://`), pois o CORS está configurado para aceitar apenas essa origem (`app.enableCors({ origin: process.env.FRONTEND_URL })`).

## Docker Compose (ambiente local ou VPS própria)

Para rodar a stack inteira (Postgres + backend + frontend) numa única máquina:

```bash
docker compose up --build -d
docker compose exec backend npx prisma migrate deploy
docker compose exec backend npx prisma db seed   # opcional, apenas para dados de exemplo
```

## Checklist antes de ir para produção

- [ ] `JWT_SECRET` e `JWT_REFRESH_SECRET` trocados por valores fortes e únicos (nunca os do `.env.example`)
- [ ] `DATABASE_URL` de produção configurada e migrations aplicadas (`migrate deploy`, nunca `migrate dev`)
- [ ] `FRONTEND_URL` no backend apontando para o domínio real do frontend
- [ ] `NEXT_PUBLIC_API_URL` no frontend apontando para o domínio real do backend
- [ ] Rate limiting (`THROTTLE_*`) ajustado ao tráfego esperado
- [ ] Backup automático habilitado no Supabase
