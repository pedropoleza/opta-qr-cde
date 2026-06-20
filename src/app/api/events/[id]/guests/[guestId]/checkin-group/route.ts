import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentOrgId, jsonError, findOrgEvent } from "@/lib/api";
import { checkInGroup } from "@/lib/checkin";

export const dynamic = "force-dynamic";

// #4 Check-in do grupo inteiro pela lista de convidados (organizador).
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; guestId: string }> },
) {
  const organizationId = await getCurrentOrgId();
  const { id, guestId } = await params;

  const event = await findOrgEvent(id, organizationId);
  if (!event) return jsonError(404, "Evento não encontrado");
  if (event.status !== "active") return jsonError(400, "Evento não está ativo");

  const guest = await prisma.guest.findFirst({ where: { id: guestId, eventId: id } });
  if (!guest) return jsonError(404, "Convidado não encontrado");

  const r = await checkInGroup(guest.id, {
    expectedEventId: id,
    deviceInfo: "manual:grupo",
  });
  return NextResponse.json({ ok: true, ...r });
}
