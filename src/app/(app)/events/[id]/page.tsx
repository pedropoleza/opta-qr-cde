import { notFound } from "next/navigation";
import { getCurrentOrgId } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { APP_BASE_URL } from "@/lib/ticket";
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

  const [guests, logs, emailLogs, sessions, checkedIn, insideNow, dupAgg, invalidAttempts] =
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
        where: { eventId: id, provider: { in: ["ghl", "resend"] } },
        orderBy: { createdAt: "desc" },
        select: { guestId: true, status: true, sentAt: true },
      }),
      prisma.eventSession.findMany({
        where: { eventId: id },
        orderBy: { createdAt: "asc" },
      }),
      prisma.ticket.count({ where: { eventId: id, status: "checked_in" } }),
      prisma.ticket.count({ where: { eventId: id, presence: "in" } }),
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

  // F4 Painel de inscrições/pagamentos.
  const paidGuests = activeGuests.filter((g) => g.paymentStatus === "paid");
  const pendingPayment = activeGuests.filter((g) => g.paymentStatus === "pending").length;
  const revenueCents = paidGuests.reduce((sum, g) => sum + (g.amountPaid ?? 0), 0);
  const currency = paidGuests.find((g) => g.currency)?.currency ?? "BRL";

  // #4 Tamanho do grupo por convidado (titular + acompanhantes).
  const groupCount = new Map<string, number>();
  for (const g of activeGuests) {
    if (!g.groupId) continue;
    groupCount.set(g.groupId, (groupCount.get(g.groupId) ?? 0) + 1);
  }

  // #6 Fluxo: entradas por porta + curva de chegada (buckets de 15 min).
  const [gateAgg, arrivalRows] = await Promise.all([
    prisma.checkInLog.groupBy({
      by: ["gate"],
      where: { eventId: id, status: { in: ["checked_in", "reentry"] } },
      _count: { _all: true },
    }),
    prisma.$queryRaw<{ bucket: Date; count: number }[]>`
      SELECT date_trunc('hour', scanned_at)
               + (floor(extract(minute from scanned_at) / 15) * interval '15 minutes') AS bucket,
             count(*)::int AS count
      FROM checkin_check_in_logs
      WHERE event_id = ${id}::uuid AND status IN ('checked_in', 'reentry')
      GROUP BY bucket
      ORDER BY bucket ASC`,
  ]);
  // #9 Resumo de NPS.
  const npsResponses = activeGuests.filter((g) => g.npsScore != null);
  const promoters = npsResponses.filter((g) => (g.npsScore ?? 0) >= 9).length;
  const detractors = npsResponses.filter((g) => (g.npsScore ?? 0) <= 6).length;
  const npsSummary = {
    responses: npsResponses.length,
    nps:
      npsResponses.length > 0
        ? Math.round(((promoters - detractors) / npsResponses.length) * 100)
        : 0,
    promoters,
    detractors,
    neutrals: npsResponses.length - promoters - detractors,
  };

  const flow = {
    nps: npsSummary,
    gates: gateAgg
      .map((g) => ({ gate: g.gate ?? "Sem porta", count: g._count._all }))
      .sort((a, b) => b.count - a.count),
    curve: arrivalRows.map((r) => ({
      label: new Date(r.bucket).toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
      }),
      count: Number(r.count),
    })),
  };

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
        vipNotifyChannel: event.vipNotifyChannel,
        vipNotifyTarget: event.vipNotifyTarget,
        ghlTag: event.ghlTag,
        whatsappMessages:
          (event.whatsappMessages as {
            default: string;
            langs: Record<string, string>;
          } | null) ?? null,
      }}
      guests={guests.map((g) => ({
        id: g.id,
        name: g.name,
        email: g.email,
        phone: g.phone,
        tier: g.tier,
        rsvp: g.rsvp,
        language: g.language,
        groupSize: g.groupId ? (groupCount.get(g.groupId) ?? 1) : 1,
        groupId: g.groupId,
        sessionId: g.sessionId,
        waitlisted: g.waitlisted,
        vip: g.vip,
        paymentStatus: g.paymentStatus,
        amountPaid: g.amountPaid,
        currency: g.currency,
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
        gate: l.gate,
      }))}
      report={{
        guests: activeGuests.length,
        qrGenerated: activeGuests.filter((g) => g.ticket).length,
        checkedIn,
        noShow: guests.filter((g) => g.status === "no_show").length,
        duplicateAttempts: dupAgg._sum.duplicateScanCount ?? 0,
        invalidAttempts,
        insideNow,
        paid: paidGuests.length,
        pendingPayment,
        revenueCents,
        currency,
      }}
      sessions={sessionData}
      flow={flow}
      appBaseUrl={APP_BASE_URL}
    />
  );
}
