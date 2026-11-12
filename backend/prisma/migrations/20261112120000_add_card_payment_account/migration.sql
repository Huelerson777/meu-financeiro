-- Conta padrão para pagar a fatura do cartão (opcional)
-- AlterTable
ALTER TABLE "cards" ADD COLUMN "payment_account_id" TEXT;

-- AddForeignKey
ALTER TABLE "cards" ADD CONSTRAINT "cards_payment_account_id_fkey" FOREIGN KEY ("payment_account_id") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
