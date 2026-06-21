-- Fase 5: white-label por tenant + auditoria de ações sensíveis.

ALTER TABLE "checkin_organizations"
  ADD COLUMN IF NOT EXISTS "brand_name" TEXT,
  ADD COLUMN IF NOT EXISTS "logo_url" TEXT,
  ADD COLUMN IF NOT EXISTS "primary_color" TEXT;

CREATE TABLE IF NOT EXISTS "checkin_audit_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "actor_id" TEXT,
    "actor_email" TEXT,
    "action" TEXT NOT NULL,
    "target" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT "checkin_audit_logs_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "checkin_audit_logs_organization_id_fkey" FOREIGN KEY ("organization_id")
        REFERENCES "checkin_organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "checkin_audit_logs_org_created_idx"
    ON "checkin_audit_logs" ("organization_id", "created_at");
