import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sparkLogoUrl } from "@/lib/ticket";
import { getEventTicketConfig } from "@/lib/ticket-config";
import { renderCertificatePdf } from "@/lib/certificate-pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Certificado de participação (#9). Só para quem fez check-in (presença
// confirmada). Público pelo token, com a marca da organização.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  const ticket = await prisma.ticket.findUnique({
    where: { token },
    select: {
      status: true,
      eventId: true,
      event: {
        select: {
          name: true,
          date: true,
          organization: {
            select: { brandName: true, logoUrl: true, primaryColor: true },
          },
        },
      },
      guest: { select: { name: true } },
    },
  });
  if (!ticket) return new NextResponse("Not found", { status: 404 });
  if (ticket.status !== "checked_in") {
    return new NextResponse("Certificado disponível após o check-in", { status: 403 });
  }

  const org = ticket.event.organization;
  const { config } = await getEventTicketConfig(ticket.eventId);
  const pdf = await renderCertificatePdf({
    guestName: ticket.guest.name,
    eventName: ticket.event.name,
    eventDate: ticket.event.date.toISOString().slice(0, 10),
    brandColor: org?.primaryColor ?? config.brandColor,
    brandName: org?.brandName ?? null,
    logoUrl: org?.logoUrl ?? config.logoUrl,
    sparkLogoUrl: sparkLogoUrl(),
    headerEffect: config.headerEffect,
    background: config.background,
  });

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Cache-Control": "private, max-age=0, must-revalidate",
      "Content-Disposition": `inline; filename="certificado-${token.slice(0, 8)}.pdf"`,
    },
  });
}
