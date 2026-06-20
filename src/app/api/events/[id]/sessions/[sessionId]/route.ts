import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentOrgId, jsonError, findOrgEvent } from "@/lib/api";

export const dynamic = "force-dynamic";

// #8 Remove uma sessão (desvincula os convidados dela).
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; sessionId: string }> },
) {
  const organizationId = await getCurrentOrgId();
  const { id, sessionId } = await params;
  const event = await findOrgEvent(id, organizationId);
  if (!event) return jsonError(404, "Evento não encontrado");

  const session = await prisma.eventSession.findFirst({
    where: { id: sessionId, eventId: id },
  });
  if (!session) return jsonError(404, "Sessão não encontrada");

  await prisma.$transaction([
    prisma.guest.updateMany({
      where: { sessionId, eventId: id },
      data: { sessionId: null },
    }),
    prisma.eventSession.delete({ where: { id: sessionId } }),
  ]);
  return NextResponse.json({ ok: true });
}
