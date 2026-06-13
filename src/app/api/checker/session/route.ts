import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createCheckerSession } from "@/lib/auth";
import { jsonError } from "@/lib/api";

// D4: o Checker autentica com o link único do evento + PIN temporário,
// sem login do organizador e sem acesso a dados sensíveis.
export async function POST(req: NextRequest) {
  const { token, pin } = await req.json();
  if (!token || !pin) return jsonError(400, "Informe o PIN");

  const event = await prisma.event.findUnique({
    where: { checkerToken: String(token) },
    select: { id: true, name: true, status: true, checkerPin: true },
  });
  if (!event || event.checkerPin !== String(pin).trim()) {
    return jsonError(401, "PIN inválido");
  }
  if (event.status === "canceled") return jsonError(400, "Evento cancelado");

  await createCheckerSession(event.id);
  return NextResponse.json({ ok: true, eventId: event.id, eventName: event.name });
}
