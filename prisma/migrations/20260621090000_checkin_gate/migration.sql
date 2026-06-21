-- #6: ponto/porta de credenciamento no log de check-in.
ALTER TABLE "checkin_check_in_logs" ADD COLUMN IF NOT EXISTS "gate" TEXT;
