-- #7: controle de entrada/saída & re-entrada.
ALTER TABLE "checkin_tickets" ADD COLUMN IF NOT EXISTS "presence" TEXT NOT NULL DEFAULT 'out';
UPDATE "checkin_tickets" SET "presence" = 'in' WHERE "status" = 'checked_in' AND "presence" = 'out';
