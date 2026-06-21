import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentMembership, jsonError } from "@/lib/api";

export const dynamic = "force-dynamic";

async function scoped(eventId: string) {
  const m = await getCurrentMembership();
  const event = await prisma.event.findFirst({
    where: { id: eventId, organizationId: m.organization.id },
    select: { id: true, kioskToken: true },
  });
  return { m, event };
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { event } = await scoped(id);
  if (!event) return jsonError(404, "Evento não encontrado");
  return NextResponse.json({ kioskToken: event.kioskToken });
}

// Habilita/regenera o totem (gera novo token) — owner/gerente.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { m, event } = await scoped(id);
  if (!event) return jsonError(404, "Evento não encontrado");
  if (m.role === "member") return jsonError(403, "Sem permissão.");
  const kioskToken = crypto.randomBytes(15).toString("base64url");
  await prisma.event.update({ where: { id }, data: { kioskToken } });
  return NextResponse.json({ kioskToken });
}

// Desativa o totem.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { m, event } = await scoped(id);
  if (!event) return jsonError(404, "Evento não encontrado");
  if (m.role === "member") return jsonError(403, "Sem permissão.");
  await prisma.event.update({ where: { id }, data: { kioskToken: null } });
  return NextResponse.json({ ok: true });
}
