# ---- Build stage ----
FROM node:20-alpine AS builder
RUN apk add --no-cache openssl
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma
RUN npm install
COPY . .
RUN npx prisma generate
RUN npm run build

# ---- Production stage ----
FROM node:20-alpine AS production
# A linha abaixo foi adicionada para corrigir o erro do Prisma!
RUN apk add --no-cache openssl procps
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
COPY prisma ./prisma
RUN npm install --omit=dev
RUN npx prisma generate
COPY --from=builder /app/dist ./dist

EXPOSE 3001
# Sincroniza o schema com o banco (útil para docker compose up de primeira viagem)
# e então inicia a API. Em produção "de verdade" prefira migrations versionadas
# (veja docs/DEPLOY.md) em vez de db push.
CMD ["sh", "-c", "npx prisma db push --skip-generate --accept-data-loss && node $(find dist -name 'main.js' | head -n 1)"]