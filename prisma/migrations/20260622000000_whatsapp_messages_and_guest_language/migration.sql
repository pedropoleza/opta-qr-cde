-- Mensagem do WhatsApp por idioma (configurável) no evento + idioma por convidado.
ALTER TABLE "checkin_events" ADD COLUMN IF NOT EXISTS "whatsapp_messages" JSONB;
ALTER TABLE "checkin_guests" ADD COLUMN IF NOT EXISTS "language" TEXT NOT NULL DEFAULT 'pt_BR';
