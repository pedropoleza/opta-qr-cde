import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentOrgId, jsonError, findOrgEvent } from "@/lib/api";

export const dynamic = "force-dynamic";

// #7 Métricas ao vivo do evento (telão de operação).
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const organizationId = await getCurrentOrgId();
  const { id } = await params;

  const event = await findOrgEvent(id, organizationId);
  if (!event) return jsonError(404, "Evento não encontrado");

  const now = new Date();
  const tenMinAgo = new Date(now.getTime() - 10 * 60_000);

  const [checkedIn, totalGuests, recent, last10min] = await Promise.all([
    prisma.ticket.count({ where: { eventId: id, status: "checked_in" } }),
    prisma.guest.count({ where: { eventId: id, status: { not: "canceled" } } }),
    prisma.checkInLog.findMany({
      where: { eventId: id, status: "checked_in" },
      orderBy: { scannedAt: "desc" },
      take: 10,
      include: { guest: { select: { name: true } } },
    }),
    prisma.checkInLog.count({
      where: {
        eventId: id,
        status: "checked_in",
        scannedAt: { gte: tenMinAgo },
      },
    }),
  ]);

  return NextResponse.json({
    checkedIn,
    totalGuests,
    capacity: event.capacity,
    last10min,
    ratePerMin: Math.round((last10min / 10) * 10) / 10,
    recent: recent.map((l) => ({
      name: l.guest?.name ?? "—",
      at: l.scannedAt.toISOString(),
    })),
    updatedAt: now.toISOString(),
  });
}
