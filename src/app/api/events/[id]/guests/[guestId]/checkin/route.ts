import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentOrgId, jsonError, findOrgEvent } from "@/lib/api";
import { performCheckIn } from "@/lib/checkin";

// Marcar presença manualmente pela Guest List (Etapa 2) — usa o mesmo
// caminho atômico do scanner, então respeita unicidade e logs.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; guestId: string }> }
) {
  const organizationId = await getCurrentOrgId();
  const { id, guestId } = await params;

  const event = await findOrgEvent(id, organizationId);
  if (!event) return jsonError(404, "Evento não encontrado");
  if (event.status !== "active") return jsonError(400, "Evento não está ativo");

  const ticket = await prisma.ticket.findUnique({ where: { guestId } });
  if (!ticket || ticket.eventId !== id) {
    return jsonError(400, "Convidado ainda não tem ticket gerado");
  }

  const result = await performCheckIn(ticket.id, {
    expectedEventId: id,
    deviceInfo: "manual:guest-list",
    ipAddress: req.headers.get("x-forwarded-for") ?? undefined,
  });
  return NextResponse.json(result);
}
