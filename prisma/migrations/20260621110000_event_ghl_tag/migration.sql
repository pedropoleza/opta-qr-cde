-- Tag do Spark por evento (filtro/importação por tag).
ALTER TABLE "checkin_events" ADD COLUMN IF NOT EXISTS "ghl_tag" TEXT;
