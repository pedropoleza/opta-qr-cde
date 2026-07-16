import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { mapLeadForm, pickEventForAgenda } from "@/lib/integration";
import { logWebhook } from "@/lib/webhook-log";
import { enforceRateLimit } from "@/lib/rate-limit";

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

  if (!fields.name && !fields.email && !fields.phone) {
    await logWebhook("lead", token, "invalid_body", {
      detail: "sem nome/email/telefone",
    });
    return NextResponse.json(
      { error: "Informe ao menos nome, e-mail ou telefone" },
      { status: 400 },
    );
  }
  if (!fields.agenda) {
    await logWebhook("lead", token, "no_match", { detail: "campo Agenda ausente" });
    return NextResponse.json(
      { error: "Campo 'agenda' ausente" },
      { status: 400 },
    );
  }

  // Eventos da organização — resolve pelo texto da "Agenda".
  const events = await prisma.event.findMany({
    where: { organizationId },
    select: { id: true, name: true, date: true, status: true },
  });
  const event = pickEventForAgenda(events, fields.agenda);
  if (!event) {
    await logWebhook("lead", token, "no_match", {
      detail: `Agenda "${fields.agenda}" não corresponde a nenhum evento`,
    });
    return NextResponse.json(
      { error: "Nenhum evento corresponde à agenda", agenda: fields.agenda },
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
        ghlContactId: fields.ghlContactId ?? existing.ghlContactId,
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
      ghlContactId: fields.ghlContactId,
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
