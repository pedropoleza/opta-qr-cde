-- Sessões/horários por evento, com capacidade própria (#8).
CREATE TABLE IF NOT EXISTS "checkin_sessions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "event_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "capacity" INTEGER,
    "starts_at" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT "checkin_sessions_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "checkin_sessions_event_idx" ON "checkin_sessions"("event_id");
ALTER TABLE "checkin_sessions" ADD CONSTRAINT "checkin_sessions_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "checkin_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "checkin_guests" ADD COLUMN IF NOT EXISTS "session_id" UUID;
CREATE INDEX IF NOT EXISTS "checkin_guests_session_idx" ON "checkin_guests"("session_id");
