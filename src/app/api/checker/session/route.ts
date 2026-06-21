import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createCheckerSession } from "@/lib/auth";
import { jsonError } from "@/lib/api";
import { clientIp, enforceRateLimit } from "@/lib/rate-limit";

// D4: o Checker autentica com o link único do evento + PIN temporário,
// sem login do organizador e sem acesso a dados sensíveis.
export async function POST(req: NextRequest) {
  const { token, pin, gate } = await req.json();
  if (!token || !pin) return jsonError(400, "Informe o PIN");

  // Anti força-bruta do PIN: por IP + token do evento.
  const limited = await enforceRateLimit(
    req,
    "checker-pin",
    10,
    300,
    `${clientIp(req)}:${String(token).slice(0, 40)}`,
  );
  if (limited) return limited;

  const event = await prisma.event.findUnique({
    where: { checkerToken: String(token) },
    select: { id: true, name: true, status: true, checkerPin: true },
  });
  if (!event || event.checkerPin !== String(pin).trim()) {
    return jsonError(401, "PIN inválido");
  }
  if (event.status === "canceled") return jsonError(400, "Evento cancelado");

  const gateLabel = gate ? String(gate).trim().slice(0, 40) : undefined;
  await createCheckerSession(event.id, gateLabel || undefined);
  return NextResponse.json({ ok: true, eventId: event.id, eventName: event.name });
}
