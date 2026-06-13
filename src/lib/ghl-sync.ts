import { Prisma } from "@prisma/client";

// Camada de rastreamento no HighLevel (seção 3.5).
// V1 Etapa 2: apenas ENFILEIRA os jobs em checkin_ghl_sync_jobs; o worker que
// consome a fila e chama a API do GHL é implementado na Etapa 4 (D7: fila no
// próprio Postgres processada por cron). Jobs só são enfileirados para
// convidados com ghl_contact_id — convidados de CSV passam a ser sincronizados
// quando o contato GHL for vinculado.

type Tx = Prisma.TransactionClient;

type GuestRef = {
  id: string;
  eventId: string;
  ghlContactId: string | null;
};

export async function enqueueAddTag(tx: Tx, guest: GuestRef, tag: string) {
  if (!guest.ghlContactId) return;
  await tx.ghlSyncJob.create({
    data: {
      eventId: guest.eventId,
      guestId: guest.id,
      ghlContactId: guest.ghlContactId,
      action: "add_tag",
      payload: { tag },
    },
  });
}

export async function enqueueCheckInSync(
  tx: Tx,
  guest: GuestRef,
  eventSlug: string,
  eventName: string,
  checkedInAt: Date
) {
  if (!guest.ghlContactId) return;
  const base = {
    eventId: guest.eventId,
    guestId: guest.id,
    ghlContactId: guest.ghlContactId,
  };
  // Três ações do check-in (seção 3.5): tag presente, custom fields e nota.
  await tx.ghlSyncJob.createMany({
    data: [
      {
        ...base,
        action: "add_tag",
        payload: { tag: `presente-evento-${eventSlug}` },
      },
      {
        ...base,
        action: "update_fields",
        payload: {
          event_checkin_status: "checked_in",
          event_checked_in_at: checkedInAt.toISOString(),
        },
      },
      {
        ...base,
        action: "add_note",
        payload: {
          note: `Check-in confirmado no evento "${eventName}" em ${checkedInAt.toISOString()}.`,
        },
      },
    ],
  });
}

export async function enqueueNoShowBatch(
  tx: Tx,
  eventSlug: string,
  guests: GuestRef[]
) {
  const data = guests
    .filter((g) => g.ghlContactId)
    .map((g) => ({
      eventId: g.eventId,
      guestId: g.id,
      ghlContactId: g.ghlContactId!,
      action: "add_tag",
      payload: { tag: `no-show-${eventSlug}` },
    }));
  if (data.length === 0) return;
  await tx.ghlSyncJob.createMany({ data });
}
