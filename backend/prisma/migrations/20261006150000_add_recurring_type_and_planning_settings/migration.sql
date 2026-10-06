-- AlterTable
ALTER TABLE "recurring_bills" ADD COLUMN     "type" "TransactionType" NOT NULL DEFAULT 'EXPENSE';

-- AlterTable
ALTER TABLE "settings" ADD COLUMN     "monthly_spending_limit" DECIMAL(14,2),
ADD COLUMN     "projection_expected_income" DECIMAL(14,2),
ADD COLUMN     "projection_flexible_spend" DECIMAL(14,2);
