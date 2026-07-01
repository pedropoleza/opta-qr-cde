-- Como o check-in foi confirmado: qr | manual | kiosk | other.
ALTER TABLE "checkin_check_in_logs" ADD COLUMN IF NOT EXISTS "method" TEXT NOT NULL DEFAULT 'qr';
