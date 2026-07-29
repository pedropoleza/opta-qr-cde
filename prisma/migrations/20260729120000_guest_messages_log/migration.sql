-- Registro de mensagens por convidado (contador por tipo + entrega confiável).
-- Mirror idempotente do apply_migration.

create table if not exists "checkin_guest_messages" (
  "id" uuid primary key default gen_random_uuid(),
  "guest_id" uuid not null references "checkin_guests"("id") on delete cascade,
  "event_id" uuid not null references "checkin_events"("id") on delete cascade,
  "kind" text not null,
  "channel" text not null,
  "status" text not null default 'queued',
  "provider" text,
  "error" text,
  "created_at" timestamptz not null default now(),
  "sent_at" timestamptz
);
create index if not exists "idx_guest_messages_guest_kind" on "checkin_guest_messages"("guest_id", "kind");
create index if not exists "idx_guest_messages_event_kind" on "checkin_guest_messages"("event_id", "kind");
