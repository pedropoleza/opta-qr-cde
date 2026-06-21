-- #9: pesquisa/NPS pós-evento.
ALTER TABLE "checkin_guests"
  ADD COLUMN IF NOT EXISTS "nps_score" INTEGER,
  ADD COLUMN IF NOT EXISTS "nps_comment" TEXT,
  ADD COLUMN IF NOT EXISTS "nps_at" TIMESTAMPTZ;
