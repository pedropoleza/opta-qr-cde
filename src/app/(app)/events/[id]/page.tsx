import { notFound } from "next/navigation";
import { getCurrentOrgId } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { EventDetail } from "@/components/events/event-detail";

export const dynamic = "force-dynamic";

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const organizationId = await getCurrentOrgId();
  const { id } = await params;

  const event = await prisma.event.findFirst({
    where: { id, organizationId },
  });
  if (!event) notFound();

  const [guests, logs, emailLogs, sessions, checkedIn, dupAgg, invalidAttempts] =
    await Promise.all([
      prisma.guest.findMany({
        where: { eventId: id },
        orderBy: { createdAt: "asc" },
        include: { ticket: { select: { token: true, checkedInAt: true } } },
      }),
      prisma.checkInLog.findMany({
        where: { eventId: id },
        orderBy: { scannedAt: "desc" },
        take: 100,
        include: { guest: { select: { name: true } } },
      }),
      prisma.emailLog.findMany({
        where: { eventId: id, provider: "ghl" },
        orderBy: { createdAt: "desc" },
        select: { guestId: true, status: true, sentAt: true },
      }),
      prisma.eventSession.findMany({
        where: { eventId: id },
        orderBy: { createdAt: "asc" },
      }),
      prisma.ticket.count({ where: { eventId: id, status: "checked_in" } }),
      prisma.ticket.aggregate({
        where: { eventId: id },
        _sum: { duplicateScanCount: true },
      }),
      prisma.checkInLog.count({
        where: { eventId: id, status: { in: ["invalid", "wrong_event"] } },
      }),
    ]);

  // Status de entrega do e-mail por convidado (último registro vence).
  const emailByGuest = new Map<string, { status: string; sentAt: Date | null }>();
  for (const log of emailLogs) {
    if (!emailByGuest.has(log.guestId)) {
      emailByGuest.set(log.guestId, { status: log.status, sentAt: log.sentAt });
    }
  }

  const activeGuests = guests.filter((g) => g.status !== "canceled");

  // #4 Tamanho do grupo por convidado (titular + acompanhantes).
  const groupCount = new Map<string, number>();
  for (const g of activeGuests) {
    if (!g.groupId) continue;
    groupCount.set(g.groupId, (groupCount.get(g.groupId) ?? 0) + 1);
  }

  // #8 Ocupação por sessão.
  const sessionData = sessions.map((s) => {
    const members = activeGuests.filter((g) => g.sessionId === s.id);
    return {
      id: s.id,
      name: s.name,
      capacity: s.capacity,
      startsAt: s.startsAt,
      assigned: members.length,
      checkedIn: members.filter((g) => g.status === "checked_in").length,
    };
  });

  return (
    <EventDetail
      event={{
        id: event.id,
        name: event.name,
        slug: event.slug,
        date: event.date.toISOString().slice(0, 10),
        startTime: event.startTime,
        endTime: event.endTime,
        locationName: event.locationName,
        address: event.address,
        capacity: event.capacity,
        status: event.status,
        checkerToken: event.checkerToken,
        checkerPin: event.checkerPin,
      }}
      guests={guests.map((g) => ({
        id: g.id,
        name: g.name,
        email: g.email,
        phone: g.phone,
        tier: g.tier,
        rsvp: g.rsvp,
        groupSize: g.groupId ? (groupCount.get(g.groupId) ?? 1) : 1,
        sessionId: g.sessionId,
        source: g.source,
        status: g.status,
        ticketToken: g.ticket?.token ?? null,
        checkedInAt: g.ticket?.checkedInAt?.toISOString() ?? null,
        emailStatus: emailByGuest.get(g.id)?.status ?? null,
        emailSentAt: emailByGuest.get(g.id)?.sentAt?.toISOString() ?? null,
      }))}
      logs={logs.map((l) => ({
        id: l.id,
        status: l.status,
        message: l.message,
        guestId: l.guestId,
        guestName: l.guest?.name ?? null,
        scannedAt: l.scannedAt.toISOString(),
        deviceInfo: l.deviceInfo,
      }))}
      report={{
        guests: activeGuests.length,
        qrGenerated: activeGuests.filter((g) => g.ticket).length,
        checkedIn,
        noShow: guests.filter((g) => g.status === "no_show").length,
        duplicateAttempts: dupAgg._sum.duplicateScanCount ?? 0,
        invalidAttempts,
      }}
      sessions={sessionData}
      appBaseUrl={process.env.APP_BASE_URL ?? "http://localhost:3000"}
    />
  );
}
