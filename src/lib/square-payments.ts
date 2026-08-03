import { prisma } from "@/lib/prisma";
import { appBaseUrl } from "@/lib/integration";
import { normalizePhone } from "@/lib/stevo";
import { ensureTicket } from "@/lib/checkin";
import { enqueueQrDelivery } from "@/lib/delivery";
import { renderTemplate, buildContext, textToHtml } from "@/lib/templates";
import {
  squareConfigured,
  createPaymentLink,
  listPaymentsSince,
  getOrderReferenceId,
  type SquarePaymentSummary,
} from "@/lib/square-api";
import { getAppSetting, setAppSetting } from "@/lib/app-settings";
import { logWebhook } from "@/lib/webhook-log";

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
  // Recurso determinístico: o pagamento pode não trazer reference_id e ter um
  // order_id diferente do template do link. Buscamos o pedido no Square para ler
  // o reference_id (= id do convidado). Resolve mesmo com e-mail divergente.
  if (p.orderId && !p.referenceId) {
    const ref = await getOrderReferenceId(p.orderId);
    if (ref) {
      const g = await prisma.guest.findFirst({
        where: { id: ref, event: { organizationId } },
      });
      if (g) return g;
    }
  }
  // Fallback fuzzy: mesma "handle" (parte antes do @) em domínios diferentes —
  // pega quem paga com e-mail pessoal diferente do cadastro (ex.: mesmo usuário
  // em gmail vs icloud, caso da Cristina). Escopo ESTREITO para não casar a
  // pessoa errada: eventos ativos, handle com >=4 chars, e só quando NÃO é
  // ambíguo (valor igual único, ou um único candidato).
  if (p.email) {
    const handle = p.email.split("@")[0]?.trim().toLowerCase() ?? "";
    if (handle.length >= 4) {
      const candidates = await prisma.guest.findMany({
        where: {
          email: { startsWith: `${handle}@`, mode: "insensitive" },
          event: { organizationId, status: { in: ["active", "draft"] } },
        },
        include: { event: { include: { integration: true } } },
        orderBy: { createdAt: "desc" },
      });
      const pending = candidates.filter((g) => g.paymentStatus !== "paid");
      const pool = pending.length ? pending : candidates;
      if (p.amount != null) {
        const byAmount = pool.filter(
          (g) => g.event.integration?.priceCents === p.amount,
        );
        if (byAmount.length === 1) return byAmount[0];
      }
      if (pool.length === 1) return pool[0];
      // Ambíguo → não adivinha; segue para a fila de não-conciliados.
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

// Cursor durável da conciliação: guardamos o created_at do pagamento mais
// recente já varrido e, a cada rodada, buscamos tudo DESDE esse instante. Sem a
// janela fixa de 3h, nenhum pagamento "expira" sem ser conciliado.
const RECON_CURSOR_KEY = "square_recon_cursor";
// Primeira rodada (sem cursor): varre os últimos 30 dias para recuperar
// pagamentos órfãos de quando o webhook estava quebrado.
const RECON_INITIAL_BACKFILL_MS = 30 * 86400 * 1000;
// Pequena sobreposição ao avançar o cursor, para não perder o pagamento da
// fronteira entre uma rodada e a próxima.
const RECON_OVERLAP_MS = 60 * 1000;

// Parkeia um pagamento pago que não casou com nenhum convidado, para re-tentar
// nas próximas rodadas (o convidado pode ser criado depois). Melhor-esforço:
// se a tabela ainda não existir, não derruba a conciliação.
async function parkUnmatchedPayment(p: SquarePaymentSummary): Promise<void> {
  try {
    await prisma.$executeRaw`
      INSERT INTO checkin_unmatched_payments
        (payment_id, email, amount, currency, order_id, reference_id, paid_at, first_seen_at, last_tried_at)
      VALUES (${p.id}, ${p.email}, ${p.amount}, ${p.currency}, ${p.orderId},
              ${p.referenceId}, ${p.createdAt ? new Date(p.createdAt) : null}, now(), now())
      ON CONFLICT (payment_id) DO UPDATE SET last_tried_at = now()
    `;
  } catch {
    /* tabela pode não existir ainda — melhor-esforço */
  }
}

async function touchUnmatched(paymentId: string): Promise<void> {
  try {
    await prisma.$executeRaw`
      UPDATE checkin_unmatched_payments SET last_tried_at = now() WHERE payment_id = ${paymentId}
    `;
  } catch {
    /* melhor-esforço */
  }
}

// Re-tenta casar os pagamentos parkeados; ao casar, settla (ticket + QR) e
// marca como resolvido. Retorna quantos foram settlados nesta rodada.
async function retryUnmatchedPayments(organizationId: string): Promise<number> {
  type Row = {
    payment_id: string;
    email: string | null;
    amount: number | null;
    currency: string | null;
    order_id: string | null;
    reference_id: string | null;
  };
  let rows: Row[] = [];
  try {
    rows = await prisma.$queryRaw<Row[]>`
      SELECT payment_id, email, amount, currency, order_id, reference_id
      FROM checkin_unmatched_payments
      WHERE resolved_at IS NULL
      ORDER BY first_seen_at ASC
      LIMIT 100
    `;
  } catch {
    return 0;
  }

  let settled = 0;
  for (const r of rows) {
    const guest = await matchGuestForPayment(organizationId, {
      referenceId: r.reference_id,
      orderId: r.order_id,
      email: r.email,
      amount: r.amount,
    });
    if (!guest) {
      await touchUnmatched(r.payment_id);
      continue;
    }
    if (guest.paymentStatus !== "paid") {
      try {
        await settlePaidGuest(guest.id, {
          amount: r.amount,
          currency: r.currency,
          paymentRef: r.payment_id,
        });
        settled++;
      } catch {
        await touchUnmatched(r.payment_id);
        continue;
      }
    }
    try {
      await prisma.$executeRaw`
        UPDATE checkin_unmatched_payments
        SET resolved_at = now(), guest_id = ${guest.id}, last_tried_at = now()
        WHERE payment_id = ${r.payment_id}
      `;
    } catch {
      /* melhor-esforço */
    }
  }
  return settled;
}

export type UnmatchedPayment = {
  payment_id: string;
  email: string | null;
  amount: number | null;
  currency: string | null;
  order_id: string | null;
  first_seen_at: Date;
};

// Lista os pagamentos pagos que ainda não casaram com nenhum convidado, para
// vínculo manual no painel. Best-effort: [] se a tabela não existir.
export async function listUnmatchedPayments(): Promise<UnmatchedPayment[]> {
  try {
    return await prisma.$queryRaw<UnmatchedPayment[]>`
      SELECT payment_id, email, amount, currency, order_id, first_seen_at
      FROM checkin_unmatched_payments
      WHERE resolved_at IS NULL
      ORDER BY first_seen_at DESC
      LIMIT 100
    `;
  } catch {
    return [];
  }
}

// Vincula manualmente um pagamento órfão a um convidado: settla (ticket + QR
// com o valor real do pagamento) e marca o órfão como resolvido.
export async function linkUnmatchedPayment(
  paymentId: string,
  guestId: string,
): Promise<{ ok: boolean; error?: string; queued?: boolean; via?: string }> {
  let row: { amount: number | null; currency: string | null } | undefined;
  try {
    const rows = await prisma.$queryRaw<
      Array<{ amount: number | null; currency: string | null }>
    >`
      SELECT amount, currency FROM checkin_unmatched_payments
      WHERE payment_id = ${paymentId} AND resolved_at IS NULL LIMIT 1
    `;
    row = rows?.[0];
  } catch {
    return { ok: false, error: "fila indisponível" };
  }
  if (!row) return { ok: false, error: "pagamento não encontrado na fila" };

  const settled = await settlePaidGuest(guestId, {
    amount: row.amount,
    currency: row.currency,
    paymentRef: paymentId,
  });
  if (!settled.ok) return { ok: false, error: "convidado não encontrado" };

  try {
    await prisma.$executeRaw`
      UPDATE checkin_unmatched_payments
      SET resolved_at = now(), guest_id = ${guestId}, last_tried_at = now()
      WHERE payment_id = ${paymentId}
    `;
  } catch {
    /* melhor-esforço: o settle já ocorreu */
  }
  return { ok: true, queued: settled.queued, via: settled.via };
}

// Rede de segurança do webhook: PUXA os pagamentos da API do Square (não depende
// de webhook, assinatura nem URL) e concilia. Durável (cursor, sem janela de 3h)
// e observável (erro da API e não-conciliados vão para o log/fila, em vez de
// sumirem em silêncio).
export async function reconcileSquarePayments(): Promise<{
  checked: number;
  paid: number;
  unmatched: number;
  retried: number;
  error?: string;
}> {
  if (!squareConfigured()) return { checked: 0, paid: 0, unmatched: 0, retried: 0 };
  const organizationId = await defaultOrgId();
  if (!organizationId) return { checked: 0, paid: 0, unmatched: 0, retried: 0 };

  const cursorIso = await getAppSetting(RECON_CURSOR_KEY);
  const beginIso =
    cursorIso ?? new Date(Date.now() - RECON_INITIAL_BACKFILL_MS).toISOString();

  let payments: SquarePaymentSummary[];
  try {
    payments = await listPaymentsSince(beginIso);
  } catch (err) {
    // NÃO engole: token/subscription quebrado precisa ficar visível na hora.
    const detail = err instanceof Error ? err.message.slice(0, 180) : "erro";
    await logWebhook("square-recon", null, "api_error", { detail });
    return { checked: 0, paid: 0, unmatched: 0, retried: 0, error: detail };
  }

  let paid = 0;
  let unmatched = 0;
  let newestMs = cursorIso ? Date.parse(cursorIso) : 0;

  for (const p of payments) {
    const tMs = p.createdAt ? Date.parse(p.createdAt) : NaN;
    if (Number.isFinite(tMs) && tMs > newestMs) newestMs = tMs;
    if (!PAID_STATUSES.includes(p.status)) continue;

    // Idempotência: cada pagamento é processado uma única vez (namespace próprio
    // `recon:`, não colide com o webhook). Evita re-log e chamadas repetidas à
    // API quando o cursor re-inclui a fronteira; re-tentativas de match ficam a
    // cargo da fila de não-conciliados (retryUnmatchedPayments).
    try {
      await prisma.webhookEvent.create({
        data: { provider: "square", externalId: `recon:${p.id}` },
      });
    } catch {
      continue; // já processado numa rodada anterior
    }

    const guest = await matchGuestForPayment(organizationId, p);
    if (!guest) {
      await parkUnmatchedPayment(p);
      await logWebhook("square-recon", null, "no_match", {
        detail: `pay=${p.id} email=${p.email ?? "-"} amount=${p.amount ?? "-"} order=${p.orderId ?? "-"}`,
      });
      unmatched++;
      continue;
    }
    if (guest.paymentStatus === "paid") continue;
    try {
      await settlePaidGuest(guest.id, {
        amount: p.amount,
        currency: p.currency,
        paymentRef: p.id,
      });
      paid++;
    } catch {
      // Falhou o settle: parkeia para re-tentar (cursor avança, mas nada some).
      await parkUnmatchedPayment(p);
      unmatched++;
    }
  }

  // Avança o cursor (com sobreposição) só após a varredura terminar OK.
  if (newestMs > 0) {
    await setAppSetting(
      RECON_CURSOR_KEY,
      new Date(newestMs - RECON_OVERLAP_MS).toISOString(),
    );
  }

  // Re-tenta os pagamentos parkeados de rodadas anteriores (convidado pode ter
  // sido criado depois). Nada é descartado em silêncio.
  const retried = await retryUnmatchedPayments(organizationId);

  return { checked: payments.length, paid, unmatched, retried };
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
