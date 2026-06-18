import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentOrgId, jsonError, findOrgEvent } from "@/lib/api";
import { slugify } from "@/lib/slug";
import { enqueueNoShowBatch } from "@/lib/ghl-sync";

const EVENT_STATUSES = ["draft", "active", "completed", "canceled"];

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const organizationId = await getCurrentOrgId();
  const { id } = await params;

  const event = await prisma.event.findFirst({
    where: { id, organizationId },
    include: { _count: { select: { guests: true, tickets: true } } },
  });
  if (!event) return jsonError(404, "Evento não encontrado");
  return NextResponse.json({ event });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const organizationId = await getCurrentOrgId();
  const { id } = await params;

  const event = await findOrgEvent(id, organizationId);
  if (!event) return jsonError(404, "Evento não encontrado");

  const body = await req.json();
  const data: Record<string, unknown> = {};
  if (body.name) {
    data.name = body.name;
    data.slug = slugify(body.name);
  }
  if (body.date) data.date = new Date(body.date);
  for (const f of ["startTime", "endTime", "locationName", "address"] as const) {
    if (f in body) data[f] = body[f] || null;
  }
  if ("capacity" in body) data.capacity = body.capacity ? Number(body.capacity) : null;
  if (body.status) {
    if (!EVENT_STATUSES.includes(body.status)) return jsonError(400, "Status inválido");
    data.status = body.status;
  }

  const closingEvent = body.status === "completed" && event.status !== "completed";

  const updated = await prisma.$transaction(async (tx) => {
    const u = await tx.event.update({ where: { id }, data });

    // Encerramento do evento: quem não fez check-in vira no_show e a tag
    // no-show-{evento} é enfileirada em lote (seções 2.1 e 3.5).
    if (closingEvent) {
      const absent = await tx.guest.findMany({
        where: {
          eventId: id,
          status: { notIn: ["checked_in", "canceled", "no_show"] },
        },
        select: { id: true, eventId: true, ghlContactId: true },
      });
      await tx.guest.updateMany({
        where: { id: { in: absent.map((g) => g.id) } },
        data: { status: "no_show" },
      });
      await enqueueNoShowBatch(tx, u.slug, absent);
    }
    return u;
  });

  return NextResponse.json({ event: updated });
}
