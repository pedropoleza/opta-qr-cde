-- RSVP do convidado (yes/no) — #10.
ALTER TABLE "checkin_guests" ADD COLUMN IF NOT EXISTS "rsvp" TEXT;
