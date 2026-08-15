-- AlterTable
ALTER TABLE "transactions" ADD COLUMN     "recurring_bill_id" TEXT;

-- CreateTable
CREATE TABLE "recurring_bills" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "category_id" TEXT,
    "account_id" TEXT,
    "description" TEXT NOT NULL,
    "default_amount" DECIMAL(14,2),
    "due_day" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recurring_bills_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "recurring_bills_user_id_idx" ON "recurring_bills"("user_id");

-- CreateIndex
CREATE INDEX "transactions_recurring_bill_id_idx" ON "transactions"("recurring_bill_id");

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_recurring_bill_id_fkey" FOREIGN KEY ("recurring_bill_id") REFERENCES "recurring_bills"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_bills" ADD CONSTRAINT "recurring_bills_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_bills" ADD CONSTRAINT "recurring_bills_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_bills" ADD CONSTRAINT "recurring_bills_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
