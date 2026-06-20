import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCheckerSession } from "@/lib/auth";
import { jsonError } from "@/lib/api";
import { checkInGroup } from "@/lib/checkin";

export const dynamic = "force-dynamic";

// #4 Check-in do grupo inteiro (titular + acompanhantes) pelo Checker.
export async function POST(req: NextRequest) {
  const checker = await getCheckerSession();
  if (!checker) return jsonError(401, "Sessão de Checker necessária");

  const { guestId } = await req.json().catch(() => ({}));
  if (!guestId) return jsonError(400, "guestId obrigatório");

  const guest = await prisma.guest.findUnique({
    where: { id: String(guestId) },
    include: { event: { select: { status: true } } },
  });
  if (!guest || guest.eventId !== checker.eventId) {
    return jsonError(404, "Convidado não encontrado");
  }
  if (guest.event.status !== "active") {
    return jsonError(400, "Evento não está ativo");
  }

  const r = await checkInGroup(guest.id, {
    expectedEventId: checker.eventId,
    checkerUserId: "checker-pin",
    deviceInfo: "checker:grupo",
  });

  return NextResponse.json({
    result: "checked_in",
    message: `${r.checkedIn} entrada(s)${r.alreadyIn ? ` · ${r.alreadyIn} já presente(s)` : ""}`,
    guestName: `${guest.name} (grupo de ${r.total})`,
    group: r,
  });
}
