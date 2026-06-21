import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { prisma } from "@/lib/prisma";
import { ticketValidationUrl, ticketPublicQrUrl, sparkLogoUrl, isVipGuest } from "@/lib/ticket";
import { renderTicketPdf } from "@/lib/ticket-pdf";
import { getEventTicketConfig } from "@/lib/ticket-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// PDF do ingresso (público, igual ao PNG do QR — o token é o segredo do
// convidado). Renderiza o modelo (Fase 1: padrão moderno) com dados do evento
// e do contato. A customização por modelo entra na Fase 2.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  const ticket = await prisma.ticket.findUnique({
    where: { token },
    select: {
      token: true,
      signature: true,
      eventId: true,
      event: {
        select: {
          name: true,
          date: true,
          startTime: true,
          locationName: true,
          address: true,
        },
      },
      guest: { select: { name: true, email: true, phone: true, vip: true, tier: true } },
    },
  });
  if (!ticket) return new NextResponse("Not found", { status: 404 });

  const qrDataUrl = await QRCode.toDataURL(
    ticketValidationUrl(ticket.token, ticket.signature),
    { width: 512, margin: 1, errorCorrectionLevel: "M" },
  );

  const { config } = await getEventTicketConfig(ticket.eventId);

  const pdf = await renderTicketPdf(
    {
      event: {
        name: ticket.event.name,
        date: ticket.event.date.toISOString().slice(0, 10),
        time: ticket.event.startTime,
        location: ticket.event.locationName ?? ticket.event.address,
      },
      contact: {
        name: ticket.guest.name,
        email: ticket.guest.email,
        phone: ticket.guest.phone,
      },
      qrDataUrl,
      ticketUrl: ticketPublicQrUrl(ticket.token),
      sparkLogoUrl: sparkLogoUrl(),
      vip: isVipGuest(ticket.guest),
    },
    config,
  );

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      // Sem cache de CDN: mudanças de design refletem na hora.
      "Cache-Control": "private, max-age=0, must-revalidate",
      "Content-Disposition": `inline; filename="ingresso-${token.slice(0, 8)}.pdf"`,
    },
  });
}
