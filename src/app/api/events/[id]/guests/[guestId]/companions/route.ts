import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentOrgId, jsonError, findOrgEvent } from "@/lib/api";
import { capacityStatus } from "@/lib/capacity";

export const dynamic = "force-dynamic";

// Adiciona um acompanhante (+1) a um convidado já existente, no mesmo grupo.
// Respeita a capacidade (#1): se lotado, entra na lista de espera.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; guestId: string }> },
) {
  const organizationId = await getCurrentOrgId();
  const { id, guestId } = await params;

  const event = await findOrgEvent(id, organizationId);
  if (!event) return jsonError(404, "Evento não encontrado");

  const host = await prisma.guest.findFirst({ where: { id: guestId, eventId: id } });
  if (!host) return jsonError(404, "Convidado não encontrado");
  if (host.status === "canceled") return jsonError(400, "Convidado cancelado.");

  const body = await req.json().catch(() => ({}));
  const name = String(body.name ?? "").trim();
  if (!name) return jsonError(400, "Informe o nome do acompanhante.");

  const cap = await capacityStatus(id);
  const waitlisted = cap.available != null && cap.available <= 0;

  // O titular vira "cabeça" do grupo (groupId = id dele) se ainda não for.
  const groupId = host.groupId ?? host.id;

  const companion = await prisma.$transaction(async (tx) => {
    if (!host.groupId) {
      await tx.guest.update({ where: { id: host.id }, data: { groupId } });
    }
    return tx.guest.create({
      data: {
        eventId: id,
        name,
        tier: host.tier,
        source: "manual",
        status: "pending_qr",
        groupId,
        waitlisted,
      },
    });
  });

  return NextResponse.json({ ok: true, guest: companion, waitlisted }, { status: 201 });
}
