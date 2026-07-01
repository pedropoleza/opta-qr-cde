import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentMembership, jsonError } from "@/lib/api";

export const dynamic = "force-dynamic";

const CHANNELS = ["whatsapp", "email", "ghl"];
const AUDIENCES = ["paid", "confirmed", "all"];

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; ruleId: string }> },
) {
  const { id, ruleId } = await params;
  const m = await getCurrentMembership();
  if (m.role === "member") return jsonError(403, "Sem permissão.");
  const event = await prisma.event.findFirst({
    where: { id, organizationId: m.organization.id },
    select: { id: true },
  });
  if (!event) return jsonError(404, "Evento não encontrado");

  const b = await req.json().catch(() => ({}));
  const str = (v: unknown) => {
    const s = typeof v === "string" ? v.trim() : "";
    return s ? s : null;
  };
  const data: Record<string, unknown> = {};
  if ("offsetHours" in b && Number.isFinite(Number(b.offsetHours)))
    data.offsetHours = Math.round(Number(b.offsetHours));
  if (CHANNELS.includes(b.channel)) data.channel = b.channel;
  if (AUDIENCES.includes(b.audience)) data.audience = b.audience;
  if ("label" in b) data.label = str(b.label);
  if ("subject" in b) data.subject = str(b.subject);
  if ("body" in b) data.body = str(b.body);
  if ("active" in b) data.active = Boolean(b.active);

  const res = await prisma.reminderRule.updateMany({
    where: { id: ruleId, eventId: id },
    data,
  });
  if (res.count === 0) return jsonError(404, "Regra não encontrada");
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; ruleId: string }> },
) {
  const { id, ruleId } = await params;
  const m = await getCurrentMembership();
  if (m.role === "member") return jsonError(403, "Sem permissão.");
  const event = await prisma.event.findFirst({
    where: { id, organizationId: m.organization.id },
    select: { id: true },
  });
  if (!event) return jsonError(404, "Evento não encontrado");
  await prisma.reminderRule.deleteMany({ where: { id: ruleId, eventId: id } });
  return NextResponse.json({ ok: true });
}
