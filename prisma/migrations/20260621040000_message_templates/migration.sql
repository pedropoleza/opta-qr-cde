-- F2: mensagens configuráveis (templates) + msg de inscrição.
CREATE TABLE IF NOT EXISTS "checkin_message_templates" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "event_id" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT "checkin_message_templates_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "checkin_message_templates_event_id_fkey" FOREIGN KEY ("event_id")
        REFERENCES "checkin_events"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "checkin_message_templates_event_id_kind_key" ON "checkin_message_templates" ("event_id", "kind");

ALTER TABLE "checkin_event_integrations"
  ADD COLUMN IF NOT EXISTS "send_msg_on_registration" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "registration_channel" TEXT NOT NULL DEFAULT 'whatsapp';
