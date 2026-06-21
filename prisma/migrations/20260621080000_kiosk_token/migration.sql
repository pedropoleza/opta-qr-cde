-- #5: totem de auto-checkin.
ALTER TABLE "checkin_events" ADD COLUMN IF NOT EXISTS "kiosk_token" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "checkin_events_kiosk_token_key" ON "checkin_events" ("kiosk_token");
