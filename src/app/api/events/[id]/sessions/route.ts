import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentOrgId, jsonError, findOrgEvent } from "@/lib/api";

export const dynamic = "force-dynamic";

// #8 Cria uma sessão/horário do evento.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const organizationId = await getCurrentOrgId();
  const { id } = await params;
  const event = await findOrgEvent(id, organizationId);
  if (!event) return jsonError(404, "Evento não encontrado");

  const body = await req.json().catch(() => ({}));
  const name = String(body.name ?? "").trim();
  if (!name) return jsonError(400, "Informe o nome da sessão");

  const session = await prisma.eventSession.create({
    data: {
      eventId: id,
      name,
      capacity: body.capacity ? Number(body.capacity) : null,
      startsAt: body.startsAt ? String(body.startsAt).trim() : null,
    },
  });
  return NextResponse.json({ session }, { status: 201 });
}
