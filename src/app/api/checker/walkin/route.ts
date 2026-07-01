import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCheckerSession } from "@/lib/auth";
import { jsonError } from "@/lib/api";
import { ensureTicket, performCheckIn } from "@/lib/checkin";

export const dynamic = "force-dynamic";

// #2 Walk-in: cadastra um convidado na porta e já faz o check-in num passo.
export async function POST(req: NextRequest) {
  const checker = await getCheckerSession();
  if (!checker) return jsonError(401, "Sessão de Checker necessária");

  const body = await req.json().catch(() => ({}));
  const name = String(body.name ?? "").trim();
  if (!name) return jsonError(400, "Informe o nome");

  const event = await prisma.event.findUnique({
    where: { id: checker.eventId },
    select: { status: true },
  });
  if (!event || event.status !== "active") {
    return jsonError(400, "Evento não está ativo");
  }

  const guest = await prisma.guest.create({
    data: {
      eventId: checker.eventId,
      name,
      email: body.email ? String(body.email).trim() : null,
      phone: body.phone ? String(body.phone).trim() : null,
      tier: body.tier ? String(body.tier).trim() : null,
      source: "manual",
      status: "qr_generated",
    },
  });

  const ticket = await ensureTicket(checker.eventId, guest.id);
  const result = await performCheckIn(ticket.id, {
    expectedEventId: checker.eventId,
    checkerUserId: "checker-pin",
    deviceInfo: "checker:walkin",
    method: "manual",
    ipAddress: req.headers.get("x-forwarded-for") ?? undefined,
    gate: checker.gate,
  });
  return NextResponse.json(result);
}
