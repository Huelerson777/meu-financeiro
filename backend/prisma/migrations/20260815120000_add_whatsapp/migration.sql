-- AlterTable
ALTER TABLE "users" ADD COLUMN     "whatsapp_number" TEXT;

-- CreateTable
CREATE TABLE "whatsapp_sessions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "phone_number" TEXT NOT NULL,
    "messages" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "whatsapp_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "whatsapp_sessions_user_id_idx" ON "whatsapp_sessions"("user_id");

-- CreateIndex
CREATE INDEX "whatsapp_sessions_phone_number_idx" ON "whatsapp_sessions"("phone_number");

-- CreateIndex
CREATE UNIQUE INDEX "users_whatsapp_number_key" ON "users"("whatsapp_number");

-- AddForeignKey
ALTER TABLE "whatsapp_sessions" ADD CONSTRAINT "whatsapp_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
