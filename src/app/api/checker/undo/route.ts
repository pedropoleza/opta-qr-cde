import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCheckerSession } from "@/lib/auth";
import { jsonError } from "@/lib/api";
import { undoCheckIn } from "@/lib/checkin";

export const dynamic = "force-dynamic";

// #6 Desfazer check-in pelo Checker (corrige engano da equipe).
export async function POST(req: NextRequest) {
  const checker = await getCheckerSession();
  if (!checker) return jsonError(401, "Sessão de Checker necessária");

  const { guestId } = await req.json().catch(() => ({}));
  if (!guestId) return jsonError(400, "guestId obrigatório");

  const guest = await prisma.guest.findUnique({
    where: { id: String(guestId) },
    include: { ticket: true },
  });
  if (!guest || guest.eventId !== checker.eventId) {
    return jsonError(404, "Convidado não encontrado");
  }
  if (!guest.ticket) return jsonError(400, "Convidado sem check-in");

  const result = await undoCheckIn(guest.ticket.id, {
    expectedEventId: checker.eventId,
    checkerUserId: "checker-pin",
    deviceInfo: "checker:undo",
  });
  if (!result.ok) return jsonError(400, result.message);
  return NextResponse.json(result);
}
