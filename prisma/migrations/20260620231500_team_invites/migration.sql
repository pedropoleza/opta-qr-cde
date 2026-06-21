-- Equipe: e-mail no membership + convites por organização.
ALTER TABLE "checkin_memberships" ADD COLUMN IF NOT EXISTS "email" TEXT;
CREATE TABLE IF NOT EXISTS "checkin_invites" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL,
  "email" TEXT NOT NULL,
  "role" TEXT NOT NULL DEFAULT 'member',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "checkin_invites_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "checkin_invites_org_email_key" ON "checkin_invites"("organization_id","email");
ALTER TABLE "checkin_invites" ADD CONSTRAINT "checkin_invites_org_fkey" FOREIGN KEY ("organization_id") REFERENCES "checkin_organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
