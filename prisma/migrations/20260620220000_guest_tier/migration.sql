-- Categoria do ingresso (VIP/Geral/Imprensa...) por convidado.
ALTER TABLE "checkin_guests" ADD COLUMN IF NOT EXISTS "tier" TEXT;
