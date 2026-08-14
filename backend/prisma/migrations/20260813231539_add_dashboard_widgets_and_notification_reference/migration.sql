-- AlterTable
ALTER TABLE "notifications" ADD COLUMN     "reference_id" TEXT;

-- AlterTable
ALTER TABLE "settings" ADD COLUMN     "dashboard_widgets" JSONB;

-- CreateIndex
CREATE INDEX "notifications_reference_id_idx" ON "notifications"("reference_id");

