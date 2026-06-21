import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/api";
import { ensureTicket, performCheckIn } from "@/lib/checkin";
import { enforceRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

// Auto check-in pelo totem (#5): valida o kioskToken e dá entrada no convidado.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const limited = await enforceRateLimit(req, "kiosk-checkin", 120, 60, token);
  if (limited) return limited;

  const event = await prisma.event.findUnique({
    where: { kioskToken: token },
    select: { id: true, status: true },
  });
  if (!event) return jsonError(404, "Totem inválido");
  if (event.status !== "active") return jsonError(400, "Evento não está ativo");

  const body = await req.json().catch(() => ({}));
  const guestId = String(body.guestId ?? "");
  if (!guestId) return jsonError(400, "Convidado não informado");

  const guest = await prisma.guest.findFirst({
    where: { id: guestId, eventId: event.id, status: { not: "canceled" } },
    select: { id: true },
  });
  if (!guest) return jsonError(404, "Convidado não encontrado");

  const ticket = await ensureTicket(event.id, guest.id);
  const result = await performCheckIn(ticket.id, {
    expectedEventId: event.id,
    checkerUserId: "kiosk",
    deviceInfo: "kiosk:self-checkin",
    ipAddress: req.headers.get("x-forwarded-for") ?? undefined,
  });
  return NextResponse.json(result);
}
