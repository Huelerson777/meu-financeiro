-- AlterTable
ALTER TABLE "installments" ADD COLUMN     "paid_from_account_id" TEXT,
ADD COLUMN     "paid_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "installments_paid_from_account_id_idx" ON "installments"("paid_from_account_id");

-- AddForeignKey
ALTER TABLE "installments" ADD CONSTRAINT "installments_paid_from_account_id_fkey" FOREIGN KEY ("paid_from_account_id") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
