import { prisma } from "@/lib/prisma";
import { ghlConfigured, ghlSearchContactsByTag, type GhlContact } from "@/lib/ghl";
import { rateLimit } from "@/lib/rate-limit";

// Entrada automática de leads por TAG do Spark/GHL.
//
// Cada evento tem uma tag (`ghlTag`, ex.: "evento-cafe com elas"). Os contatos
// que a automação do cliente marca com essa tag entram automaticamente no
// evento como convidados, já com pagamento "Aguardando pagamento" (pending).
// Quando o Square confirmar, o webhook do Square vira o status para "pago".

export type LeadSyncResult = {
  eventId: string;
  tag: string | null;
  total: number; // contatos com a tag
  created: number; // novos convidados
  updated: number; // convidados já existentes (só backfill de dados)
  skipped: boolean; // sem tag / sem conexão / evento encerrado
  reason?: string;
};

// Sincroniza UM evento: puxa os contatos com a tag e faz upsert dos convidados.
export async function syncEventLeadsByTag(eventId: string): Promise<LeadSyncResult> {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true, organizationId: true, ghlTag: true, status: true },
  });
  if (!event) {
    return { eventId, tag: null, total: 0, created: 0, updated: 0, skipped: true, reason: "evento inexistente" };
  }
  const tag = event.ghlTag?.trim();
  if (!tag) {
    return { eventId, tag: null, total: 0, created: 0, updated: 0, skipped: true, reason: "evento sem tag" };
  }
  if (["completed", "canceled"].includes(event.status)) {
    return { eventId, tag, total: 0, created: 0, updated: 0, skipped: true, reason: "evento encerrado" };
  }
  if (!(await ghlConfigured(event.organizationId))) {
    return { eventId, tag, total: 0, created: 0, updated: 0, skipped: true, reason: "Spark não conectado" };
  }

  const contacts = await ghlSearchContactsByTag(event.organizationId, tag);

  // Convidados já existentes no evento (dedupe por ghlContactId/email/phone).
  const existingGuests = await prisma.guest.findMany({
    where: { eventId },
    select: { id: true, ghlContactId: true, email: true, phone: true, name: true },
  });
  const byGhlId = new Map(existingGuests.filter((g) => g.ghlContactId).map((g) => [g.ghlContactId!, g]));
  const byEmail = new Map(
    existingGuests.filter((g) => g.email).map((g) => [g.email!.toLowerCase(), g]),
  );
  const byPhone = new Map(
    existingGuests.filter((g) => g.phone).map((g) => [normalizePhone(g.phone!), g]),
  );

  let created = 0;
  let updated = 0;

  for (const c of contacts) {
    const match =
      (c.id && byGhlId.get(c.id)) ||
      (c.email && byEmail.get(c.email.toLowerCase())) ||
      (c.phone && byPhone.get(normalizePhone(c.phone))) ||
      null;

    if (match) {
      // Só faz backfill de dados que faltam; NUNCA mexe no status de pagamento.
      const data: Record<string, unknown> = {};
      if (!match.ghlContactId && c.id) data.ghlContactId = c.id;
      if (!match.email && c.email) data.email = c.email;
      if (!match.phone && c.phone) data.phone = c.phone;
      if ((!match.name || match.name === "Sem nome") && c.name) data.name = c.name;
      if (Object.keys(data).length > 0) {
        await prisma.guest.update({ where: { id: match.id }, data });
        updated++;
      }
      continue;
    }

    const name = pickName(c);
    await prisma.guest.create({
      data: {
        eventId,
        ghlContactId: c.id ?? null,
        name,
        email: c.email ?? null,
        phone: c.phone ?? null,
        source: "ghl",
        status: "pending_qr",
        paymentStatus: "pending", // "Aguardando pagamento"
      },
    });
    // Evita duplicar quando o mesmo contato aparece 2x na lista.
    if (c.id) byGhlId.set(c.id, { id: "new", ghlContactId: c.id, email: c.email, phone: c.phone, name });
    if (c.email) byEmail.set(c.email.toLowerCase(), { id: "new", ghlContactId: c.id, email: c.email, phone: c.phone, name });
    if (c.phone) byPhone.set(normalizePhone(c.phone), { id: "new", ghlContactId: c.id, email: c.email, phone: c.phone, name });
    created++;
  }

  return { eventId, tag, total: contacts.length, created, updated, skipped: false };
}

// Roda para todos os eventos ATIVOS com tag, com throttle por evento (para não
// martelar a API do Spark). Chamado pelo cron a cada minuto.
export async function syncAllTaggedEvents(): Promise<{
  events: number;
  created: number;
  updated: number;
}> {
  const events = await prisma.event.findMany({
    where: { status: "active", ghlTag: { not: null } },
    select: { id: true },
  });
  let created = 0;
  let updated = 0;
  let count = 0;
  for (const e of events) {
    // No máximo 1 sincronização por evento a cada 3 minutos.
    const gate = await rateLimit(`leadsync:${e.id}`, 1, 180);
    if (!gate.ok) continue;
    try {
      const r = await syncEventLeadsByTag(e.id);
      if (!r.skipped) {
        created += r.created;
        updated += r.updated;
        count++;
      }
    } catch {
      /* best-effort; próxima rodada tenta de novo */
    }
  }
  return { events: count, created, updated };
}

function pickName(c: GhlContact): string {
  const n = (c.name ?? "").trim();
  if (n && n !== "Sem nome") return n;
  if (c.email) return c.email.split("@")[0];
  if (c.phone) return c.phone;
  return "Convidado";
}

function normalizePhone(p: string): string {
  return p.replace(/\D/g, "");
}
