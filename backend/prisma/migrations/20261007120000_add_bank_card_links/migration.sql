-- CreateTable
CREATE TABLE "bank_card_links" (
    "id" TEXT NOT NULL,
    "connection_id" TEXT NOT NULL,
    "pluggy_account_id" TEXT NOT NULL,
    "card_id" TEXT NOT NULL,
    "starts_at" TIMESTAMP(3) NOT NULL,
    "last_sync_at" TIMESTAMP(3),

    CONSTRAINT "bank_card_links_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "bank_card_links_connection_id_pluggy_account_id_key" ON "bank_card_links"("connection_id", "pluggy_account_id");

-- AddForeignKey
ALTER TABLE "bank_card_links" ADD CONSTRAINT "bank_card_links_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "bank_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_card_links" ADD CONSTRAINT "bank_card_links_card_id_fkey" FOREIGN KEY ("card_id") REFERENCES "cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;
