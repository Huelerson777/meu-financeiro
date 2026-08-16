-- AlterTable
ALTER TABLE "transactions" ADD COLUMN     "transfer_id" TEXT,
ALTER COLUMN "account_id" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "transactions_transfer_id_key" ON "transactions"("transfer_id");

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_transfer_id_fkey" FOREIGN KEY ("transfer_id") REFERENCES "transfers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

