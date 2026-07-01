import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentMembership, jsonError } from "@/lib/api";

export const dynamic = "force-dynamic";

const CHANNELS = ["whatsapp", "email", "ghl"];
const AUDIENCES = ["paid", "confirmed", "all"];

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
  const rules = await prisma.reminderRule.findMany({
    where: { eventId: id },
    orderBy: { offsetHours: "asc" },
    select: {
      id: true,
      offsetHours: true,
      channel: true,
      audience: true,
      label: true,
      subject: true,
      body: true,
      active: true,
      lastRunAt: true,
    },
  });
  return NextResponse.json({ rules });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { m, event } = await scopedEvent(id);
  if (!event) return jsonError(404, "Evento não encontrado");
  if (m.role === "member") return jsonError(403, "Sem permissão.");

  const body = await req.json().catch(() => ({}));
  const offsetHours = Number(body.offsetHours);
  if (!Number.isFinite(offsetHours)) return jsonError(400, "Offset inválido.");
  const channel = CHANNELS.includes(body.channel) ? body.channel : "whatsapp";
  const audience = AUDIENCES.includes(body.audience) ? body.audience : "paid";
  const str = (v: unknown) => {
    const s = typeof v === "string" ? v.trim() : "";
    return s ? s : null;
  };

  const rule = await prisma.reminderRule.create({
    data: {
      eventId: id,
      offsetHours: Math.round(offsetHours),
      channel,
      audience,
      label: str(body.label),
      subject: str(body.subject),
      body: str(body.body),
    },
  });
  return NextResponse.json({ rule }, { status: 201 });
}
