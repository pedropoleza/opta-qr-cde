import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOrganizer, jsonError, findOrgEvent } from "@/lib/api";
import { generateTicketToken, signTicket } from "@/lib/ticket";

// Geração de ticket (seção 2.4): token único base64url(uuid) + assinatura
// HMAC_SHA256(event_id + guest_id + token). Gera para todos os convidados
// sem ticket, ou apenas para os guestIds informados no body.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireOrganizer();
  if (session instanceof NextResponse) return session;
  const { id } = await params;

  const event = await findOrgEvent(id, session.organizationId);
  if (!event) return jsonError(404, "Evento não encontrado");

  const body = await req.json().catch(() => ({}));
  const guestIds: string[] | undefined = Array.isArray(body.guestIds)
    ? body.guestIds
    : undefined;

  const guests = await prisma.guest.findMany({
    where: {
      eventId: id,
      status: { not: "canceled" },
      ticket: null,
      ...(guestIds ? { id: { in: guestIds } } : {}),
    },
  });

  let generated = 0;
  for (const guest of guests) {
    const token = generateTicketToken();
    const signature = signTicket(id, guest.id, token);
    await prisma.$transaction([
      prisma.ticket.create({
        data: { eventId: id, guestId: guest.id, token, signature, status: "active" },
      }),
      prisma.guest.update({
        where: { id: guest.id },
        data: { status: "qr_generated" },
      }),
    ]);
    generated++;
  }

  return NextResponse.json({ generated });
}
