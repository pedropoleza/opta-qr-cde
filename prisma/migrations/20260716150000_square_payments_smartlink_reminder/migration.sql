-- Link inteligente do Square por convidado + lembrete de pagamento (30 min).
-- Aditiva e idempotente (mirror do apply_migration aplicado no banco).

ALTER TABLE "checkin_event_integrations"
  ADD COLUMN IF NOT EXISTS "price_cents" integer,
  ADD COLUMN IF NOT EXISTS "currency" text NOT NULL DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS "payment_reminder_enabled" boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "payment_reminder_minutes" integer NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS "payment_reminder_message" text;

ALTER TABLE "checkin_guests"
  ADD COLUMN IF NOT EXISTS "payment_link_url" text,
  ADD COLUMN IF NOT EXISTS "payment_link_id" text,
  ADD COLUMN IF NOT EXISTS "payment_order_id" text,
  ADD COLUMN IF NOT EXISTS "payment_reminder_sent_at" timestamptz;
