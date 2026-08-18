# Deploy em Produção

Stack real de produção: **Neon** (banco) + **Render** (backend) + **Vercel** (frontend).

## Banco de Dados — Neon PostgreSQL

1. Crie um projeto em https://neon.tech.
2. Copie a **connection string** (Neon expõe um host `-pooler` para conexões em pool e um host direto — para uma API tradicional como esta, a `-pooler` é a recomendada).
3. Use essa URL como `DATABASE_URL` no backend (local e no Render).
4. Rode as migrations contra o banco de produção uma única vez a partir de uma máquina com acesso:
   ```bash
   DATABASE_URL="<url-neon>" npx prisma migrate deploy
   ```

## Backend — Render

1. Crie um novo **Web Service** no Render apontando para este repositório.
2. **Root Directory:** `backend`.
3. **Build Command:** `npm install && npx prisma generate && npm run build`.
4. **Start Command:** `npm run start:prod` (roda `node dist/main` a partir do build já compilado — **nunca** `npm run start`/`nest start`, que compila em memória a cada boot e pode estourar a memória do plano free conforme o app cresce).
5. Configure as variáveis de ambiente (ver `docs/ENVIRONMENT.md`), incluindo `DATABASE_URL` apontando para o Neon.
6. Após o primeiro deploy, rode `npx prisma migrate deploy` (manual, a partir de uma máquina com acesso ao banco).
7. Anote a URL pública gerada (ex.: `https://financeiro-1o4l.onrender.com`) — ela será usada como `NEXT_PUBLIC_API_URL` no frontend.

> `backend/tsconfig.build.json` precisa continuar existindo — sem ele, `nest build` inclui `test/` e `prisma/` no cálculo da raiz do TypeScript e gera `dist/src/main.js` em vez de `dist/main.js`, quebrando o Start Command acima com `Cannot find module`.

Como o Root Directory é `backend`, o Render só dispara auto-deploy quando um commit muda algo dentro dessa pasta — um push que só toca `frontend/` não gera um novo deploy do backend (e não precisa gerar).

## Frontend — Vercel

1. Importe o repositório no Vercel, apontando o **Root Directory** para `frontend/`.
2. Configure a variável de ambiente `NEXT_PUBLIC_API_URL` com a URL pública do backend no Render, seguida de `/api` (ex.: `https://financeiro-1o4l.onrender.com/api`).
3. Build command e output ficam nos defaults do Next.js (detectado automaticamente).
4. Cada push na branch principal gera um deploy automático.

## CORS

No backend, `FRONTEND_URL` deve apontar exatamente para o domínio do Vercel (incluindo `https://`), pois o CORS está configurado para aceitar apenas essa origem (`app.enableCors({ origin: process.env.FRONTEND_URL })`).

## Checklist antes de ir para produção

- [ ] `JWT_SECRET` e `JWT_REFRESH_SECRET` trocados por valores fortes e únicos (nunca os do `.env.example`)
- [ ] `DATABASE_URL` de produção configurada e migrations aplicadas (`migrate deploy`, nunca `migrate dev`)
- [ ] `FRONTEND_URL` no backend apontando para o domínio real do frontend
- [ ] `NEXT_PUBLIC_API_URL` no frontend apontando para o domínio real do backend
- [ ] Rate limiting (`THROTTLE_*`) ajustado ao tráfego esperado
- [ ] Backup automático habilitado no Neon
