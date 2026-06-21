-- F3: lembretes agendados.
CREATE TABLE IF NOT EXISTS "checkin_reminder_rules" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "event_id" UUID NOT NULL,
    "offset_hours" INTEGER NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'whatsapp',
    "audience" TEXT NOT NULL DEFAULT 'paid',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "last_run_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT "checkin_reminder_rules_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "checkin_reminder_rules_event_id_fkey" FOREIGN KEY ("event_id")
        REFERENCES "checkin_events"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "checkin_reminder_rules_event_idx" ON "checkin_reminder_rules" ("event_id");
