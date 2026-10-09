-- AlterTable
ALTER TABLE "bank_account_links" ADD COLUMN "starts_at" TIMESTAMP(3);

-- Ligações existentes: o corte é o início (BRT) do dia em que a conexão foi criada,
-- que é de onde a primeira sincronização partiu. Nada anterior a isso deve ser importado.
UPDATE "bank_account_links" AS l
SET "starts_at" = (date_trunc('day', c."created_at" AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo')) AT TIME ZONE 'America/Sao_Paulo' AT TIME ZONE 'UTC'
FROM "bank_connections" AS c
WHERE c."id" = l."connection_id";

ALTER TABLE "bank_account_links" ALTER COLUMN "starts_at" SET NOT NULL;
