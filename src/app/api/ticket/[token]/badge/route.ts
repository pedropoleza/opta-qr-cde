import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { prisma } from "@/lib/prisma";
import { ticketValidationUrl } from "@/lib/ticket";
import { renderBadgePdf } from "@/lib/badge-pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Crachá de credenciamento (#4). Público pelo token (o segredo do convidado),
// igual ao PDF do ingresso. Usa a marca da organização (white-label).
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
      event: {
        select: {
          name: true,
          date: true,
          organization: {
            select: { brandName: true, logoUrl: true, primaryColor: true },
          },
        },
      },
      guest: {
        select: { name: true, tier: true, sessionId: true },
      },
    },
  });
  if (!ticket) return new NextResponse("Not found", { status: 404 });

  const session = ticket.guest.sessionId
    ? await prisma.eventSession.findUnique({
        where: { id: ticket.guest.sessionId },
        select: { name: true },
      })
    : null;

  const qrDataUrl = await QRCode.toDataURL(
    ticketValidationUrl(ticket.token, ticket.signature),
    { width: 256, margin: 0, errorCorrectionLevel: "M" },
  );

  const org = ticket.event.organization;
  const pdf = await renderBadgePdf({
    guestName: ticket.guest.name,
    eventName: ticket.event.name,
    eventDate: ticket.event.date.toISOString().slice(0, 10),
    tier: ticket.guest.tier,
    sessionName: session?.name ?? null,
    qrDataUrl,
    brandColor: org?.primaryColor ?? null,
    brandName: org?.brandName ?? null,
    logoUrl: org?.logoUrl ?? null,
  });

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Cache-Control": "private, max-age=120",
      "Content-Disposition": `inline; filename="cracha-${token.slice(0, 8)}.pdf"`,
    },
  });
}
