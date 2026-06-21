import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentMembership, jsonError } from "@/lib/api";

export const dynamic = "force-dynamic";

const KINDS = ["registration", "qr_delivery", "reminder"];

async function scopedEvent(eventId: string) {
  const m = await getCurrentMembership();
  const event = await prisma.event.findFirst({
    where: { id: eventId, organizationId: m.organization.id },
    select: { id: true },
  });
  return { m, event };
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { event } = await scopedEvent(id);
  if (!event) return jsonError(404, "Evento não encontrado");
  const templates = await prisma.messageTemplate.findMany({
    where: { eventId: id },
    select: { kind: true, subject: true, body: true, active: true },
  });
  return NextResponse.json({ templates });
}

// Upsert de um template por kind.
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { m, event } = await scopedEvent(id);
  if (!event) return jsonError(404, "Evento não encontrado");
  if (m.role === "member") return jsonError(403, "Sem permissão.");

  const body = await req.json().catch(() => ({}));
  const kind = KINDS.includes(body.kind) ? body.kind : null;
  if (!kind) return jsonError(400, "Tipo inválido.");
  const text = String(body.body ?? "").trim();
  if (!text) return jsonError(400, "A mensagem não pode ficar vazia.");
  const subject = body.subject != null ? String(body.subject).trim() || null : null;
  const active = body.active !== undefined ? Boolean(body.active) : true;

  await prisma.messageTemplate.upsert({
    where: { eventId_kind: { eventId: id, kind } },
    create: { eventId: id, kind, subject, body: text, active },
    update: { subject, body: text, active },
  });
  return NextResponse.json({ ok: true });
}
