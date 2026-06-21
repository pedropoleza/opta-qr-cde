-- F1: pagamentos (Square) + integração de inscrições/pagamentos por evento.
ALTER TABLE "checkin_guests"
  ADD COLUMN IF NOT EXISTS "payment_status" TEXT NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS "amount_paid" INTEGER,
  ADD COLUMN IF NOT EXISTS "currency" TEXT,
  ADD COLUMN IF NOT EXISTS "paid_at" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "payment_ref" TEXT,
  ADD COLUMN IF NOT EXISTS "registration_ref" TEXT;

CREATE TABLE IF NOT EXISTS "checkin_event_integrations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "event_id" UUID NOT NULL,
    "registration_token" TEXT NOT NULL,
    "payment_token" TEXT NOT NULL,
    "square_signature_key" TEXT,
    "field_map" JSONB,
    "auto_send_qr_on_paid" BOOLEAN NOT NULL DEFAULT true,
    "send_channel" TEXT NOT NULL DEFAULT 'ghl',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT "checkin_event_integrations_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "checkin_event_integrations_event_id_fkey" FOREIGN KEY ("event_id")
        REFERENCES "checkin_events"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "checkin_event_integrations_event_id_key" ON "checkin_event_integrations" ("event_id");
CREATE UNIQUE INDEX IF NOT EXISTS "checkin_event_integrations_registration_token_key" ON "checkin_event_integrations" ("registration_token");
CREATE UNIQUE INDEX IF NOT EXISTS "checkin_event_integrations_payment_token_key" ON "checkin_event_integrations" ("payment_token");

CREATE TABLE IF NOT EXISTS "checkin_webhook_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "provider" TEXT NOT NULL,
    "external_id" TEXT NOT NULL,
    "event_id" UUID,
    "status" TEXT NOT NULL DEFAULT 'processed',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT "checkin_webhook_events_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "checkin_webhook_events_provider_external_id_key" ON "checkin_webhook_events" ("provider", "external_id");
