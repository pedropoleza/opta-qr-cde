import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  mapLeadForm,
  pickEventForAgenda,
  pickEventForTags,
  extractTags,
} from "@/lib/integration";
import { logWebhook } from "@/lib/webhook-log";
import { enforceRateLimit } from "@/lib/rate-limit";
import { ghlConfigured, ghlListContacts } from "@/lib/ghl";

export const dynamic = "force-dynamic";

// Webhook de LEADS (entrada por formulário do GHL).
//
// O GHL dispara este webhook assim que um contato preenche o formulário do
// evento (antes de ir ao Square). O contato é criado no evento correspondente
// com pagamento "pendente" (badge "Aguardando pagamento"). Quando o Square
// confirmar o pagamento, o webhook do Square vira o status para "pago".
//
// O evento é resolvido pelo campo "Agenda" do payload (ex.: "☕ Café com Elas").
// O :token da URL é o locationId do GHL — resolve a organização sem precisar de
// segredo/coluna nova no banco.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const limited = await enforceRateLimit(req, "hook-lead", 240, 60, token);
  if (limited) return limited;

  const organizationId = await resolveOrgByToken(token);
  if (!organizationId) {
    await logWebhook("lead", token, "no_integration", {
      detail: "locationId não corresponde a nenhuma organização",
    });
    return NextResponse.json({ error: "Endpoint inválido" }, { status: 404 });
  }

  const body = await readBody(req);
  const fields = mapLeadForm(body);
  const tags = extractTags(body);

  if (!fields.name && !fields.email && !fields.phone) {
    await logWebhook("lead", token, "invalid_body", {
      detail: "sem nome/email/telefone",
    });
    return NextResponse.json(
      { error: "Informe ao menos nome, e-mail ou telefone" },
      { status: 400 },
    );
  }

  // Eventos da organização — resolve o destino por AGENDA (campo do form) ou,
  // como alternativa, pela TAG do contato (o GHL manda as tags no payload).
  const events = await prisma.event.findMany({
    where: { organizationId },
    select: { id: true, name: true, date: true, status: true, ghlTag: true },
  });
  const event =
    (fields.agenda && pickEventForAgenda(events, fields.agenda)) ||
    pickEventForTags(events, tags);

  if (!event) {
    await logWebhook("lead", token, "no_match", {
      detail: `sem correspondência · agenda="${fields.agenda ?? ""}" tags=[${tags.join(", ")}]`,
    });
    return NextResponse.json(
      {
        error: "Nenhum evento corresponde (nem por agenda, nem por tag)",
        agenda: fields.agenda,
        tags,
      },
      { status: 404 },
    );
  }
  if (["completed", "canceled"].includes(event.status)) {
    await logWebhook("lead", token, "ignored", {
      detail: `evento "${event.name}" encerrado`,
    });
    return NextResponse.json({ error: "Evento encerrado" }, { status: 400 });
  }

  const eventId = event.id;

  // Enriquecimento: se o payload não trouxe o contactId do Spark, procura o
  // contato por e-mail/telefone para vincular (best-effort, não bloqueia).
  let ghlContactId = fields.ghlContactId;
  if (!ghlContactId && (fields.email || fields.phone)) {
    try {
      if (await ghlConfigured(organizationId)) {
        const q = fields.email ?? fields.phone ?? "";
        const { contacts } = await ghlListContacts(organizationId, { query: q, limit: 5 });
        const digits = (s: string | null) => (s ?? "").replace(/\D/g, "");
        const found = contacts.find(
          (c) =>
            (fields.email && c.email?.toLowerCase() === fields.email.toLowerCase()) ||
            (fields.phone && digits(c.phone) === digits(fields.phone)),
        );
        if (found) ghlContactId = found.id;
      }
    } catch {
      /* segue sem o contactId */
    }
  }

  // Deduplica por e-mail e, na falta dele, por telefone dentro do evento.
  const existing = await prisma.guest.findFirst({
    where: {
      eventId,
      OR: [
        fields.email
          ? { email: { equals: fields.email, mode: "insensitive" } }
          : undefined,
        fields.phone ? { phone: fields.phone } : undefined,
      ].filter(Boolean) as object[],
    },
  });

  if (existing) {
    await prisma.guest.update({
      where: { id: existing.id },
      data: {
        name: fields.name ?? existing.name,
        email: fields.email ?? existing.email,
        phone: fields.phone ?? existing.phone,
        ghlContactId: ghlContactId ?? existing.ghlContactId,
        registrationRef: fields.ref ?? existing.registrationRef,
        // Não rebaixa quem já pagou; caso contrário, deixa "aguardando".
        paymentStatus: existing.paymentStatus === "paid" ? "paid" : "pending",
      },
    });
    await logWebhook("lead", token, "queued", {
      detail: `dedupe · ${event.name} · guest ${existing.id}`,
    });
    return NextResponse.json({
      ok: true,
      guestId: existing.id,
      eventId,
      deduped: true,
    });
  }

  const guest = await prisma.guest.create({
    data: {
      eventId,
      name: fields.name ?? fields.email?.split("@")[0] ?? "Convidado",
      email: fields.email,
      phone: fields.phone,
      ghlContactId,
      source: "ghl",
      status: "pending_qr",
      paymentStatus: "pending", // "Aguardando pagamento" até o Square confirmar
      registrationRef: fields.ref,
    },
  });

  await logWebhook("lead", token, "queued", {
    detail: `novo · ${event.name} · guest ${guest.id}`,
  });
  return NextResponse.json({ ok: true, guestId: guest.id, eventId });
}

// Resolve a organização a partir do :token (locationId do GHL).
// 1) conexão GHL cujo locationId bate (multi-tenant).
// 2) fallback single-tenant: env GHL_LOCATION_ID → organização padrão.
async function resolveOrgByToken(token: string): Promise<string | null> {
  const conn = await prisma.ghlConnection.findFirst({
    where: { locationId: token },
    select: { organizationId: true },
  });
  if (conn) return conn.organizationId;

  const envLoc = process.env.GHL_LOCATION_ID?.trim();
  if (envLoc && token === envLoc) {
    const org = await prisma.organization.findFirst({
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });
    return org?.id ?? null;
  }
  return null;
}

async function readBody(req: NextRequest): Promise<Record<string, unknown>> {
  const ct = req.headers.get("content-type") ?? "";
  try {
    if (ct.includes("application/json")) {
      return (await req.json()) as Record<string, unknown>;
    }
    if (
      ct.includes("application/x-www-form-urlencoded") ||
      ct.includes("multipart/form-data")
    ) {
      const form = await req.formData();
      const obj: Record<string, unknown> = {};
      form.forEach((v, k) => (obj[k] = typeof v === "string" ? v : ""));
      return obj;
    }
    return (await req.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}
