import { prisma } from "@/lib/prisma";
import { appBaseUrl } from "@/lib/integration";
import { normalizePhone } from "@/lib/stevo";
import { ensureTicket } from "@/lib/checkin";
import { enqueueQrDelivery } from "@/lib/delivery";
import { renderTemplate, buildContext, textToHtml } from "@/lib/templates";
import {
  squareConfigured,
  createPaymentLink,
  listRecentPayments,
  type SquarePaymentSummary,
} from "@/lib/square-api";

export const PAID_STATUSES = ["COMPLETED", "APPROVED", "CAPTURED"];

// Mensagem padrão do lembrete de pagamento (30 min). Placeholders no formato do
// cliente: [NOME], [nome do evento], [LINK DE PAGAMENTO].
export const DEFAULT_PAYMENT_REMINDER = `Olá, [NOME]!

Notamos que seu registro para o evento [nome do evento] foi iniciado, mas ainda não foi concluído, pois o pagamento da inscrição está pendente.

Para facilitar, segue abaixo o link para finalizar sua inscrição e garantir sua vaga:

[LINK DE PAGAMENTO]

As vagas são limitadas e a confirmação da participação acontece após a conclusão do pagamento.

Caso tenha qualquer dúvida ou encontre alguma dificuldade durante o processo, entre em contato conosco. Será um prazer ajudar.

Equipe OPTA Finance`;

function renderReminder(
  tpl: string,
  vars: { name: string; event: string; link: string },
): string {
  return tpl
    .replace(/\[NOME\]/gi, vars.name)
    .replace(/\[nome do evento\]/gi, vars.event)
    .replace(/\[LINK DE PAGAMENTO\]/gi, vars.link)
    .replace(/\{\{\s*nome\s*\}\}/gi, vars.name)
    .replace(/\{\{\s*evento\s*\}\}/gi, vars.event)
    .replace(/\{\{\s*link\s*\}\}/gi, vars.link);
}

// Organização padrão (single-tenant) — usada nos jobs de cron/webhook.
export async function defaultOrgId(): Promise<string | null> {
  const org = await prisma.organization.findFirst({
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  return org?.id ?? null;
}

// Garante o link inteligente do Square para o convidado (cria se faltar).
// Requer preço configurado no evento e Square conectado (env).
export async function ensureGuestPaymentLink(guestId: string): Promise<string | null> {
  const guest = await prisma.guest.findUnique({
    where: { id: guestId },
    include: { event: { include: { integration: true } } },
  });
  if (!guest) return null;
  if (guest.paymentLinkUrl) return guest.paymentLinkUrl;
  if (!squareConfigured()) return null;

  const integ = guest.event.integration;
  const price = integ?.priceCents ?? null;
  if (!price || price <= 0) return null;

  const link = await createPaymentLink({
    name: `${guest.event.name} — Inscrição`,
    amountCents: price,
    currency: integ?.currency ?? "USD",
    referenceId: guest.id,
    buyerEmail: guest.email,
  });
  await prisma.guest.update({
    where: { id: guest.id },
    data: {
      paymentLinkUrl: link.url,
      paymentLinkId: link.id,
      paymentOrderId: link.orderId,
    },
  });
  return link.url;
}

type MatchablePayment = {
  referenceId: string | null;
  orderId: string | null;
  email: string | null;
  amount: number | null;
};

// Busca inteligente do convidado do pagamento:
//  1) reference_id (id do convidado) — determinístico (link inteligente).
//  2) order_id — determinístico (link inteligente).
//  3) e-mail entre eventos ativos, priorizando pendente + valor igual + recente.
export async function matchGuestForPayment(
  organizationId: string,
  p: MatchablePayment,
) {
  if (p.referenceId) {
    const g = await prisma.guest.findFirst({
      where: { id: p.referenceId, event: { organizationId } },
    });
    if (g) return g;
  }
  if (p.orderId) {
    const g = await prisma.guest.findFirst({
      where: { paymentOrderId: p.orderId, event: { organizationId } },
    });
    if (g) return g;
  }
  if (p.email) {
    const candidates = await prisma.guest.findMany({
      where: {
        email: { equals: p.email, mode: "insensitive" },
        // Só eventos ATIVOS/rascunho — evita casar pagamento no evento errado
        // (encerrados são desativados após 7 dias).
        event: { organizationId, status: { in: ["active", "draft"] } },
      },
      include: { event: { include: { integration: true } } },
      orderBy: { createdAt: "desc" },
    });
    if (candidates.length) {
      const pending = candidates.filter((g) => g.paymentStatus !== "paid");
      const pool = pending.length ? pending : candidates;
      const byAmount =
        p.amount != null
          ? pool.find((g) => g.event.integration?.priceCents === p.amount)
          : undefined;
      return byAmount ?? pool[0];
    }
  }
  return null;
}

// Marca o convidado como pago e dispara o QR (canal configurado; padrão e-mail).
// Idempotente: se já estiver pago, não reenvia.
export async function settlePaidGuest(
  guestId: string,
  payment: { amount: number | null; currency: string | null; paymentRef: string | null },
): Promise<{ ok: boolean; alreadyPaid?: boolean; queued?: boolean; via?: string }> {
  const guest = await prisma.guest.findUnique({
    where: { id: guestId },
    include: { event: { include: { integration: true } } },
  });
  if (!guest) return { ok: false };
  if (guest.paymentStatus === "paid") return { ok: true, alreadyPaid: true };

  const event = guest.event;
  const integ = event.integration;
  const channel = integ?.sendChannel ?? "email";
  const eventDate = event.date.toISOString().slice(0, 10);
  const location = event.locationName ?? event.address ?? "";

  const ticket = await ensureTicket(event.id, guest.id);

  // Template no-code de entrega do QR, se houver.
  const tpl = await prisma.messageTemplate.findUnique({
    where: { eventId_kind: { eventId: event.id, kind: "qr_delivery" } },
  });
  let overrides: { caption?: string; emailSubject?: string; emailHtml?: string } | undefined;
  if (tpl && tpl.active) {
    const ctx = buildContext({
      guestName: guest.name,
      eventName: event.name,
      eventDate,
      locationName: event.locationName,
      address: event.address,
      amountPaid: payment.amount,
      currency: payment.currency,
      token: ticket.token,
    });
    const renderedBody = renderTemplate(tpl.body, ctx);
    overrides = {
      caption: renderedBody,
      emailSubject: tpl.subject ? renderTemplate(tpl.subject, ctx) : undefined,
      emailHtml: textToHtml(renderedBody),
    };
  }

  const result = await prisma.$transaction(async (tx) => {
    await tx.guest.update({
      where: { id: guest.id },
      data: {
        paymentStatus: "paid",
        amountPaid: payment.amount,
        currency: payment.currency,
        paidAt: new Date(),
        paymentRef: payment.paymentRef,
        // Pagou → não faz sentido mandar lembrete de pendência.
        paymentReminderSentAt: guest.paymentReminderSentAt ?? new Date(),
      },
    });
    if (integ && !integ.autoSendQrOnPaid) return { queued: false, via: "off" };
    return enqueueQrDelivery(
      tx,
      {
        id: event.id,
        name: event.name,
        slug: event.slug,
        date: eventDate,
        location,
        time: event.startTime,
        organizationId: event.organizationId,
      },
      {
        id: guest.id,
        eventId: event.id,
        name: guest.name,
        email: guest.email,
        phone: guest.phone,
        ghlContactId: guest.ghlContactId,
        ticketId: ticket.id,
        token: ticket.token,
        vip: guest.vip || guest.tier === "vip",
      },
      channel,
      overrides,
    );
  });

  return { ok: true, queued: result.queued, via: result.via };
}

// Concilia pagamentos recentes do Square (rede de segurança do webhook).
export async function reconcileSquarePayments(): Promise<{
  checked: number;
  paid: number;
}> {
  if (!squareConfigured()) return { checked: 0, paid: 0 };
  const organizationId = await defaultOrgId();
  if (!organizationId) return { checked: 0, paid: 0 };

  const since = new Date(Date.now() - 3 * 3600 * 1000).toISOString();
  let payments: SquarePaymentSummary[] = [];
  try {
    payments = await listRecentPayments(since, 100);
  } catch {
    return { checked: 0, paid: 0 };
  }

  let paid = 0;
  for (const p of payments) {
    if (!PAID_STATUSES.includes(p.status)) continue;
    // Idempotência do reconciliador (namespace próprio, não colide com webhook).
    try {
      await prisma.webhookEvent.create({
        data: { provider: "square", externalId: `recon:${p.id}` },
      });
    } catch {
      continue; // já conciliado
    }
    const guest = await matchGuestForPayment(organizationId, p);
    if (!guest || guest.paymentStatus === "paid") continue;
    try {
      await settlePaidGuest(guest.id, {
        amount: p.amount,
        currency: p.currency,
        paymentRef: p.id,
      });
      paid++;
    } catch {
      /* próxima rodada tenta */
    }
  }
  return { checked: payments.length, paid };
}

// Máximo de lembretes de pagamento por convidado e cooldown entre tentativas
// (evita spam quando o envio falha repetidamente).
const MAX_PAYMENT_REMINDERS = 3;
const REMINDER_COOLDOWN_MS = 6 * 3600 * 1000;

// Lembrete de pagamento pendente (WhatsApp/Stevo) N min após o cadastro.
// A "entrega" é rastreada no GuestMessage: só conta como enviado quando o worker
// confirma. Se o envio falhar, tenta de novo (respeitando teto + cooldown) — foi
// o que corrigiu os leads que ficavam sem receber o lembrete.
export async function processPaymentReminders(): Promise<{ sent: number }> {
  const now = Date.now();
  const guests = await prisma.guest.findMany({
    where: {
      paymentStatus: { in: ["pending", "none"] },
      phone: { not: null },
      status: { notIn: ["canceled"] },
      event: { status: "active" },
    },
    include: {
      event: { include: { integration: true } },
      messages: { where: { kind: "payment_reminder" }, orderBy: { createdAt: "desc" } },
    },
    orderBy: { createdAt: "asc" },
    take: 200,
  });

  let sent = 0;
  for (const g of guests) {
    const integ = g.event.integration;
    if (!integ || !integ.paymentReminderEnabled) continue;
    const minutes = integ.paymentReminderMinutes ?? 30;
    if (g.createdAt.getTime() > now - minutes * 60_000) continue; // ainda não venceu
    if (!g.phone) continue;

    // Dedupe/entrega via registro: pula se já há um na fila ou entregue; respeita
    // teto de tentativas e cooldown quando a última falhou.
    const prior = g.messages;
    if (prior.some((m) => m.status === "queued" || m.status === "sent")) continue;
    if (prior.length >= MAX_PAYMENT_REMINDERS) continue;
    const last = prior[0];
    if (last && last.createdAt.getTime() > now - REMINDER_COOLDOWN_MS) continue;

    const link =
      (await ensureGuestPaymentLink(g.id).catch(() => null)) ??
      `${appBaseUrl()}/pay?email=${encodeURIComponent(g.email ?? "")}&agenda=${encodeURIComponent(g.event.name)}`;

    const text = renderReminder(integ.paymentReminderMessage || DEFAULT_PAYMENT_REMINDER, {
      name: g.name,
      event: g.event.name,
      link,
    });

    try {
      await prisma.$transaction(async (tx) => {
        const log = await tx.guestMessage.create({
          data: {
            guestId: g.id,
            eventId: g.eventId,
            kind: "payment_reminder",
            channel: "whatsapp",
            status: "queued",
          },
        });
        await tx.ghlSyncJob.create({
          data: {
            eventId: g.eventId,
            guestId: g.id,
            action: "send_whatsapp_text",
            payload: { to: normalizePhone(g.phone!), text, messageLogId: log.id },
          },
        });
      });
      sent++;
    } catch {
      /* próxima rodada tenta */
    }
  }
  return { sent };
}

// Desativa eventos cuja data já passou há mais de 7 dias (status → completed).
// Evita que eventos antigos continuem casando pagamentos/mensagens (evento
// incorreto) e mantém o painel limpo.
export async function deactivateStaleEvents(): Promise<{ deactivated: number }> {
  const cutoff = new Date(Date.now() - 7 * 86400 * 1000);
  const res = await prisma.event.updateMany({
    where: { status: "active", date: { lt: cutoff } },
    data: { status: "completed" },
  });
  return { deactivated: res.count };
}
