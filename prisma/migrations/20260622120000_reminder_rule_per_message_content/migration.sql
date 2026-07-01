-- Conteúdo próprio por mensagem agendada (opcional; fallback ao template "reminder").
ALTER TABLE "checkin_reminder_rules" ADD COLUMN IF NOT EXISTS "label" TEXT;
ALTER TABLE "checkin_reminder_rules" ADD COLUMN IF NOT EXISTS "subject" TEXT;
ALTER TABLE "checkin_reminder_rules" ADD COLUMN IF NOT EXISTS "body" TEXT;
