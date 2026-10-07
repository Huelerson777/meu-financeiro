-- AlterTable
ALTER TABLE "transactions" ADD COLUMN "external_id" TEXT;

-- CreateTable
CREATE TABLE "bank_connections" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "item_id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "last_sync_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bank_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_account_links" (
    "id" TEXT NOT NULL,
    "connection_id" TEXT NOT NULL,
    "pluggy_account_id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,

    CONSTRAINT "bank_account_links_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "bank_connections_user_id_item_id_key" ON "bank_connections"("user_id", "item_id");

-- CreateIndex
CREATE UNIQUE INDEX "bank_account_links_connection_id_pluggy_account_id_key" ON "bank_account_links"("connection_id", "pluggy_account_id");

-- CreateIndex
CREATE UNIQUE INDEX "transactions_user_id_external_id_key" ON "transactions"("user_id", "external_id");

-- AddForeignKey
ALTER TABLE "bank_connections" ADD CONSTRAINT "bank_connections_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_account_links" ADD CONSTRAINT "bank_account_links_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "bank_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_account_links" ADD CONSTRAINT "bank_account_links_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
