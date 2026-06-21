-- #8: protocolo VIP & anfitrião.
ALTER TABLE "checkin_guests" ADD COLUMN IF NOT EXISTS "vip" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "checkin_events"
  ADD COLUMN IF NOT EXISTS "vip_notify_channel" TEXT,
  ADD COLUMN IF NOT EXISTS "vip_notify_target" TEXT;
