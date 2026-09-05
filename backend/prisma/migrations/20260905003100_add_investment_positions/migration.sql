-- CreateEnum
CREATE TYPE "Indexer" AS ENUM ('CDI', 'SELIC', 'IPCA_PLUS', 'PREFIXADO');

-- AlterTable
ALTER TABLE "investments" ADD COLUMN     "account_id" TEXT NOT NULL,
ADD COLUMN     "transfer_id" TEXT,
ADD COLUMN     "ticker" TEXT,
ADD COLUMN     "indexer" "Indexer",
ADD COLUMN     "rate" DECIMAL(8,4),
ADD COLUMN     "start_date" TIMESTAMP(3),
ADD COLUMN     "last_valued_at" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "investments_transfer_id_key" ON "investments"("transfer_id");

-- CreateIndex
CREATE INDEX "investments_account_id_idx" ON "investments"("account_id");

-- AddForeignKey
ALTER TABLE "investments" ADD CONSTRAINT "investments_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "investments" ADD CONSTRAINT "investments_transfer_id_fkey" FOREIGN KEY ("transfer_id") REFERENCES "transfers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
