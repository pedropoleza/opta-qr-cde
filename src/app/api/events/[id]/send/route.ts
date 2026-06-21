import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentOrgId, jsonError, findOrgEvent } from "@/lib/api";
import { ticketPublicQrUrl, ticketQrImageUrl, ticketPdfUrl } from "@/lib/ticket";
import { enqueueSendQr } from "@/lib/ghl-sync";
import { stevoConfigured, normalizePhone } from "@/lib/stevo";
import { emailConfigured, ticketEmailHtml } from "@/lib/email";

// Disparo do ingresso por canal:
//  - email (D1): grava dados do QR no contato + tag-gatilho; workflow do GHL
//    envia o e-mail.
//  - whatsapp (Stevo): enfileira o envio do PDF do ingresso pelo worker.
//  - both: os dois.
// Body: { guestIds?: string[], channel?: "email" | "whatsapp" | "both" }
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const organizationId = await getCurrentOrgId();
  const { id } = await params;

  const event = await findOrgEvent(id, organizationId);
  if (!event) return jsonError(404, "Evento não encontrado");

  const body = await req.json().catch(() => ({}));
  const guestIds: string[] | undefined = Array.isArray(body.guestIds)
    ? body.guestIds
    : undefined;
  const channel: "email" | "whatsapp" | "both" =
    body.channel === "whatsapp" || body.channel === "both"
      ? body.channel
      : "email";

  const wantsWhatsapp = channel === "whatsapp" || channel === "both";
  const wantsEmail = channel === "email" || channel === "both";

  if (wantsWhatsapp && !stevoConfigured()) {
    return jsonError(
      400,
      "WhatsApp (Stevo) não configurado. Defina STEVO_API_URL e STEVO_API_KEY.",
    );
  }

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

  const directEmail = emailConfigured();

  let sent = 0;
  let withoutContact = 0;
  let withoutPhone = 0;
  let withoutEmail = 0;

  for (const guest of guests) {
    const token = guest.ticket!.token;
    await prisma.$transaction(async (tx) => {
      if (wantsEmail && directEmail) {
        // Envio direto pelo app (Resend) — não depende do workflow do GHL.
        if (guest.email) {
          const html = ticketEmailHtml({
            eventName: event.name,
            eventDate,
            eventLocation,
            guestName: guest.name,
            qrImageUrl: ticketQrImageUrl(token),
            ticketUrl: ticketPublicQrUrl(token),
            pdfUrl: ticketPdfUrl(token),
          });
          await tx.ghlSyncJob.create({
            data: {
              eventId: id,
              guestId: guest.id,
              action: "send_email",
              payload: {
                to: guest.email,
                subject: `Seu ingresso — ${event.name}`,
                html,
              },
            },
          });
          await tx.emailLog.create({
            data: {
              eventId: id,
              guestId: guest.id,
              ticketId: guest.ticket!.id,
              provider: "resend",
              status: "queued",
            },
          });
        } else {
          withoutEmail++;
        }
      } else if (wantsEmail) {
        // Modelo D1: tag-gatilho + workflow do GHL envia o e-mail.
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
            guestName: guest.name,
            eventTime: event.startTime,
            eventAddress: event.address,
            pdfUrl: ticketPdfUrl(token),
          },
        );
        await tx.emailLog.create({
          data: {
            eventId: id,
            guestId: guest.id,
            ticketId: guest.ticket!.id,
            provider: "ghl",
            status: "queued",
          },
        });
        if (!guest.ghlContactId) withoutContact++;
      }

      if (wantsWhatsapp && guest.phone) {
        await tx.ghlSyncJob.create({
          data: {
            eventId: id,
            guestId: guest.id,
            ghlContactId: guest.ghlContactId,
            action: "send_whatsapp",
            payload: {
              to: normalizePhone(guest.phone),
              url: ticketPdfUrl(token),
              filename: `ingresso-${event.slug}.pdf`,
              caption: `Olá! Aqui está o seu ingresso para ${event.name} (${eventDate}). Apresente o QR Code na entrada.`,
            },
          },
        });
        await tx.emailLog.create({
          data: {
            eventId: id,
            guestId: guest.id,
            ticketId: guest.ticket!.id,
            provider: "stevo-whatsapp",
            status: "queued",
          },
        });
      } else if (wantsWhatsapp && !guest.phone) {
        withoutPhone++;
      }

      await tx.guest.update({
        where: { id: guest.id },
        data: { status: "email_sent" },
      });
    });
    sent++;
  }

  return NextResponse.json({
    sent,
    channel,
    emailMode: directEmail ? "resend" : "ghl",
    withoutGhlContact: withoutContact,
    withoutPhone,
    withoutEmail,
  });
}
