import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentOrgId, jsonError, findOrgEvent } from "@/lib/api";
import { ticketPublicQrUrl, ticketQrImageUrl } from "@/lib/ticket";
import { enqueueSendQr } from "@/lib/ghl-sync";

// Disparo do QR por e-mail (Etapa 3, D1 = híbrida C via automação Spark/GHL).
// O app não envia o e-mail diretamente: grava os dados do QR no contato e
// aplica a tag-gatilho qrcode-enviado-{evento}; o workflow nativo do GHL
// envia o e-mail (imagem do QR + botão para a página do ingresso). O envio é
// enfileirado em checkin_ghl_sync_jobs e efetivado pelo worker (Etapa 4).
//
// Body: { guestIds?: string[] }  — omitido = todos os convidados com QR gerado.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const organizationId = await getCurrentOrgId();
  const { id } = await params;

  const event = await findOrgEvent(id, organizationId);
  if (!event) return jsonError(404, "Evento não encontrado");

  const body = await req.json().catch(() => ({}));
  const guestIds: string[] | undefined = Array.isArray(body.guestIds)
    ? body.guestIds
    : undefined;

  // Só envia para quem já tem ticket/QR gerado e não foi removido.
  const guests = await prisma.guest.findMany({
    where: {
      eventId: id,
      status: { not: "canceled" },
      ticket: { isNot: null },
      ...(guestIds ? { id: { in: guestIds } } : {}),
    },
    include: { ticket: true },
  });
  if (guests.length === 0) {
    return jsonError(400, "Nenhum convidado com QR gerado para enviar");
  }

  const eventDate = event.date.toISOString().slice(0, 10);
  const eventLocation = event.locationName ?? event.address ?? "";

  let sent = 0;
  let withoutContact = 0;
  for (const guest of guests) {
    const token = guest.ticket!.token;
    await prisma.$transaction(async (tx) => {
      // Grava os dados do QR no contato + tag-gatilho do workflow GHL.
      await enqueueSendQr(
        tx,
        { id: guest.id, eventId: id, ghlContactId: guest.ghlContactId },
        event.slug,
        {
          eventName: event.name,
          eventDate,
          eventLocation,
          qrLink: ticketPublicQrUrl(token),
          qrImageUrl: ticketQrImageUrl(token),
        }
      );
      // EmailLog: provider=ghl, status=queued (envio efetivo é do workflow GHL).
      await tx.emailLog.create({
        data: {
          eventId: id,
          guestId: guest.id,
          ticketId: guest.ticket!.id,
          provider: "ghl",
          status: "queued",
        },
      });
      await tx.guest.update({
        where: { id: guest.id },
        data: { status: "email_sent" },
      });
    });
    sent++;
    if (!guest.ghlContactId) withoutContact++;
  }

  return NextResponse.json({
    sent,
    // Convidados sem ghl_contact_id (origem CSV) não têm contato no GHL para o
    // workflow disparar — viram email_sent mas o job de sync é ignorado até
    // que o contato seja vinculado na Etapa 4.
    withoutGhlContact: withoutContact,
  });
}
