-- Vínculo usuário (Supabase Auth) ↔ organização (multi-tenant).
CREATE TABLE IF NOT EXISTS "checkin_memberships" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "role" TEXT NOT NULL DEFAULT 'owner',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "checkin_memberships_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "checkin_memberships_user_id_key" ON "checkin_memberships"("user_id");
CREATE INDEX IF NOT EXISTS "checkin_memberships_org_idx" ON "checkin_memberships"("organization_id");
ALTER TABLE "checkin_memberships" ADD CONSTRAINT "checkin_memberships_org_fkey" FOREIGN KEY ("organization_id") REFERENCES "checkin_organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
