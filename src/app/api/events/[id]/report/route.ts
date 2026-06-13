import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOrganizer, jsonError, findOrgEvent } from "@/lib/api";

// Métricas do evento (Etapa 2): convidados, QR gerados, check-ins,
// ausentes, tentativas duplicadas e inválidas.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireOrganizer();
  if (session instanceof NextResponse) return session;
  const { id } = await params;

  const event = await findOrgEvent(id, session.organizationId);
  if (!event) return jsonError(404, "Evento não encontrado");

  const [guests, qrGenerated, checkedIn, noShow, emailsSent, dupAgg, invalidAttempts] =
    await Promise.all([
      prisma.guest.count({ where: { eventId: id, status: { not: "canceled" } } }),
      prisma.ticket.count({ where: { eventId: id, status: { not: "canceled" } } }),
      prisma.ticket.count({ where: { eventId: id, status: "checked_in" } }),
      prisma.guest.count({ where: { eventId: id, status: "no_show" } }),
      prisma.emailLog.count({ where: { eventId: id, status: "sent" } }),
      prisma.ticket.aggregate({
        where: { eventId: id },
        _sum: { duplicateScanCount: true },
      }),
      prisma.checkInLog.count({
        where: { eventId: id, status: { in: ["invalid", "wrong_event"] } },
      }),
    ]);

  return NextResponse.json({
    report: {
      guests,
      qrGenerated,
      emailsSent,
      checkedIn,
      noShow,
      duplicateAttempts: dupAgg._sum.duplicateScanCount ?? 0,
      invalidAttempts,
      capacity: event.capacity,
    },
  });
}
