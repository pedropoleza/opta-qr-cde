import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentOrgId, jsonError, findOrgEvent } from "@/lib/api";

// Remoção de convidado (ação manual do organizador — seção 2.1: canceled).
// O ticket correspondente também é cancelado: o QR passa a responder Vermelho.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; guestId: string }> }
) {
  const organizationId = await getCurrentOrgId();
  const { id, guestId } = await params;

  const event = await findOrgEvent(id, organizationId);
  if (!event) return jsonError(404, "Evento não encontrado");

  const guest = await prisma.guest.findFirst({ where: { id: guestId, eventId: id } });
  if (!guest) return jsonError(404, "Convidado não encontrado");

  await prisma.$transaction([
    prisma.guest.update({ where: { id: guestId }, data: { status: "canceled" } }),
    prisma.ticket.updateMany({
      where: { guestId, status: { not: "checked_in" } },
      data: { status: "canceled" },
    }),
  ]);

  return NextResponse.json({ ok: true });
}
