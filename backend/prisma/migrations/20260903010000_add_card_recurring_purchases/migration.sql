-- AlterTable
ALTER TABLE "transactions" ADD COLUMN     "card_recurring_purchase_id" TEXT;

-- CreateTable
CREATE TABLE "card_recurring_purchases" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "card_id" TEXT NOT NULL,
    "category_id" TEXT,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "charge_day" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "card_recurring_purchases_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "card_recurring_purchases_user_id_idx" ON "card_recurring_purchases"("user_id");

-- CreateIndex
CREATE INDEX "card_recurring_purchases_card_id_idx" ON "card_recurring_purchases"("card_id");

-- CreateIndex
CREATE INDEX "transactions_card_recurring_purchase_id_idx" ON "transactions"("card_recurring_purchase_id");

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_card_recurring_purchase_id_fkey" FOREIGN KEY ("card_recurring_purchase_id") REFERENCES "card_recurring_purchases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_recurring_purchases" ADD CONSTRAINT "card_recurring_purchases_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_recurring_purchases" ADD CONSTRAINT "card_recurring_purchases_card_id_fkey" FOREIGN KEY ("card_id") REFERENCES "cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_recurring_purchases" ADD CONSTRAINT "card_recurring_purchases_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
