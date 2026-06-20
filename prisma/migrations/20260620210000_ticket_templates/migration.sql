-- Modelo (template) do ingresso em PDF — padrão por org + override por evento.
CREATE TABLE IF NOT EXISTS "checkin_ticket_templates" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "event_id" UUID,
    "config" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT "checkin_ticket_templates_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "checkin_ticket_templates_event_id_key" ON "checkin_ticket_templates"("event_id");
CREATE INDEX IF NOT EXISTS "checkin_ticket_templates_org_idx" ON "checkin_ticket_templates"("organization_id");
ALTER TABLE "checkin_ticket_templates" ADD CONSTRAINT "checkin_ticket_templates_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "checkin_organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "checkin_ticket_templates" ADD CONSTRAINT "checkin_ticket_templates_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "checkin_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
