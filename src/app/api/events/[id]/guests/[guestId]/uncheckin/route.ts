import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentOrgId, jsonError, findOrgEvent } from "@/lib/api";
import { undoCheckIn } from "@/lib/checkin";

export const dynamic = "force-dynamic";

// #6 Desfazer check-in pela lista de convidados (organizador).
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; guestId: string }> },
) {
  const organizationId = await getCurrentOrgId();
  const { id, guestId } = await params;

  const event = await findOrgEvent(id, organizationId);
  if (!event) return jsonError(404, "Evento não encontrado");

  const ticket = await prisma.ticket.findUnique({ where: { guestId } });
  if (!ticket || ticket.eventId !== id) {
    return jsonError(400, "Convidado sem check-in");
  }

  const result = await undoCheckIn(ticket.id, {
    expectedEventId: id,
    deviceInfo: "manual:undo",
    ipAddress: req.headers.get("x-forwarded-for") ?? undefined,
  });
  if (!result.ok) return jsonError(400, result.message);
  return NextResponse.json(result);
}
