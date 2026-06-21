import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentMembership, jsonError } from "@/lib/api";

export const dynamic = "force-dynamic";

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
