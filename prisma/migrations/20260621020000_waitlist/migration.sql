-- Feature #1: capacidade & lista de espera.
ALTER TABLE "checkin_guests" ADD COLUMN IF NOT EXISTS "waitlisted" BOOLEAN NOT NULL DEFAULT false;
