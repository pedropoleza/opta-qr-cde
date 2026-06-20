-- Grupo/acompanhantes do convidado (#4).
ALTER TABLE "checkin_guests" ADD COLUMN IF NOT EXISTS "group_id" UUID;
CREATE INDEX IF NOT EXISTS "checkin_guests_group_idx" ON "checkin_guests"("group_id");
