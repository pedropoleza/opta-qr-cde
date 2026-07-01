-- Log de todas as requisições recebidas em webhooks (inclusive rejeitadas).
CREATE TABLE IF NOT EXISTS "checkin_webhook_log" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "provider" TEXT NOT NULL,
  "token" TEXT,
  "outcome" TEXT NOT NULL,
  "event_type" TEXT,
  "detail" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "checkin_webhook_log_provider_created_idx" ON "checkin_webhook_log" ("provider", "created_at" DESC);
