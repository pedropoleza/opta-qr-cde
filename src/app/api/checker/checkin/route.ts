import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCheckerSession } from "@/lib/auth";
import { jsonError } from "@/lib/api";
import { ensureTicket, performCheckIn } from "@/lib/checkin";

export const dynamic = "force-dynamic";

// #1 Check-in por nome (sem QR). Garante o ticket e usa o mesmo caminho atômico.
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
  if (guest.status === "canceled") return jsonError(400, "Convidado removido");
  if (guest.event.status !== "active") {
    return jsonError(400, "Evento não está ativo");
  }

  const ticket = await ensureTicket(checker.eventId, guest.id);
  const result = await performCheckIn(ticket.id, {
    expectedEventId: checker.eventId,
    checkerUserId: "checker-pin",
    deviceInfo: "checker:busca",
    method: "manual",
    ipAddress: req.headers.get("x-forwarded-for") ?? undefined,
    gate: checker.gate,
  });
  return NextResponse.json(result);
}
