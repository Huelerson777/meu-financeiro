-- CreateTable
CREATE TABLE "recurring_bill_skips" (
    "id" TEXT NOT NULL,
    "recurring_bill_id" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recurring_bill_skips_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "recurring_bill_skips_recurring_bill_id_month_key" ON "recurring_bill_skips"("recurring_bill_id", "month");

-- AddForeignKey
ALTER TABLE "recurring_bill_skips" ADD CONSTRAINT "recurring_bill_skips_recurring_bill_id_fkey" FOREIGN KEY ("recurring_bill_id") REFERENCES "recurring_bills"("id") ON DELETE CASCADE ON UPDATE CASCADE;
