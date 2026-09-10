-- CreateTable
CREATE TABLE "mcp_clients" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "client_name" TEXT,
    "redirect_uris" TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mcp_clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mcp_authorization_codes" (
    "id" TEXT NOT NULL,
    "code_hash" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "redirect_uri" TEXT NOT NULL,
    "code_challenge" TEXT NOT NULL,
    "code_challenge_method" TEXT NOT NULL,
    "consumed" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mcp_authorization_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mcp_tokens" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "access_token_hash" TEXT NOT NULL,
    "refresh_token_hash" TEXT NOT NULL,
    "access_expires_at" TIMESTAMP(3) NOT NULL,
    "refresh_expires_at" TIMESTAMP(3) NOT NULL,
    "revoked" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mcp_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "mcp_clients_client_id_key" ON "mcp_clients"("client_id");

-- CreateIndex
CREATE UNIQUE INDEX "mcp_authorization_codes_code_hash_key" ON "mcp_authorization_codes"("code_hash");

-- CreateIndex
CREATE INDEX "mcp_authorization_codes_user_id_idx" ON "mcp_authorization_codes"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "mcp_tokens_access_token_hash_key" ON "mcp_tokens"("access_token_hash");

-- CreateIndex
CREATE UNIQUE INDEX "mcp_tokens_refresh_token_hash_key" ON "mcp_tokens"("refresh_token_hash");

-- CreateIndex
CREATE INDEX "mcp_tokens_user_id_idx" ON "mcp_tokens"("user_id");

-- AddForeignKey
ALTER TABLE "mcp_authorization_codes" ADD CONSTRAINT "mcp_authorization_codes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mcp_authorization_codes" ADD CONSTRAINT "mcp_authorization_codes_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "mcp_clients"("client_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mcp_tokens" ADD CONSTRAINT "mcp_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mcp_tokens" ADD CONSTRAINT "mcp_tokens_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "mcp_clients"("client_id") ON DELETE CASCADE ON UPDATE CASCADE;
