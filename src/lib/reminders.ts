import { prisma } from "@/lib/prisma";
import { enqueueMessage } from "@/lib/delivery";
import { renderTemplate, buildContext, textToHtml } from "@/lib/templates";

// Lembretes agendados (F3). Chamado pelo cron a cada minuto. Dispara as regras
// vencidas (offset relativo ao início do evento) uma única vez (lastRunAt).

// Momento agendado = data do evento + horário (UTC) + offset.
function scheduledAt(date: Date, startTime: string | null, offsetHours: number): Date {
  const d = new Date(date);
  const [hh, mm] = (startTime ?? "00:00").split(":");
  d.setUTCHours(Number(hh) || 0, Number(mm) || 0, 0, 0);
  return new Date(d.getTime() + offsetHours * 3600_000);
}

export async function processReminders(): Promise<{ rulesFired: number; queued: number }> {
  const now = Date.now();
  const rules = await prisma.reminderRule.findMany({
    where: {
      active: true,
      lastRunAt: null,
      event: { status: { notIn: ["completed", "canceled"] } },
    },
    include: {
      event: {
        select: {
          id: true,
          name: true,
          slug: true,
          date: true,
          startTime: true,
          locationName: true,
          address: true,
        },
      },
    },
    take: 50,
  });

  let rulesFired = 0;
  let queued = 0;

  for (const rule of rules) {
    const when = scheduledAt(rule.event.date, rule.event.startTime, rule.offsetHours).getTime();
    // Vence quando o horário chegou; ignora regras muito antigas (>48h atrás).
    if (when > now || when < now - 48 * 3600_000) continue;

    const tpl = await prisma.messageTemplate.findUnique({
      where: { eventId_kind: { eventId: rule.event.id, kind: "reminder" } },
    });

    // Conteúdo: texto próprio da regra; senão, o template "reminder".
    const bodyTpl = rule.body?.trim() || (tpl?.active ? tpl.body : null);
    const subjectTpl = rule.subject?.trim() || (tpl?.active ? tpl.subject : null);

    // Marca como executada já (idempotência mesmo se o envio falhar parcialmente).
    await prisma.reminderRule.update({
      where: { id: rule.id },
      data: { lastRunAt: new Date() },
    });
    rulesFired++;
    if (!bodyTpl) continue;

    const where = audienceFilter(rule.event.id, rule.audience);
    const guests = await prisma.guest.findMany({
      where,
      include: { ticket: { select: { token: true } } },
      take: 2000,
    });

    for (const g of guests) {
      const ctx = buildContext({
        guestName: g.name,
        eventName: rule.event.name,
        eventDate: rule.event.date.toISOString().slice(0, 10),
        startTime: rule.event.startTime,
        locationName: rule.event.locationName,
        address: rule.event.address,
        amountPaid: g.amountPaid,
        currency: g.currency,
        token: g.ticket?.token ?? null,
      });
      const body = renderTemplate(bodyTpl, ctx);

      await prisma.$transaction(async (tx) => {
        if (rule.channel === "ghl") {
          if (g.ghlContactId) {
            await tx.ghlSyncJob.create({
              data: {
                eventId: rule.event.id,
                guestId: g.id,
                ghlContactId: g.ghlContactId,
                action: "add_tag",
                payload: { tag: `lembrete-${rule.event.slug}` },
              },
            });
            queued++;
          }
        } else {
          const r = await enqueueMessage(tx, g, rule.channel, {
            subject: subjectTpl
              ? renderTemplate(subjectTpl, ctx)
              : `Lembrete — ${rule.event.name}`,
            body,
            html: textToHtml(body),
          });
          if (r.queued) queued++;
        }
      });
    }
  }

  return { rulesFired, queued };
}

function audienceFilter(eventId: string, audience: string) {
  const base = { eventId, status: { not: "canceled" } as const };
  if (audience === "all") return base;
  if (audience === "paid") return { ...base, waitlisted: false, paymentStatus: "paid" };
  return { ...base, waitlisted: false }; // confirmed
}
