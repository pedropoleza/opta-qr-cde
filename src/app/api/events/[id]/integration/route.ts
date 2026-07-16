import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentMembership, jsonError } from "@/lib/api";
import { encryptSecret } from "@/lib/crypto";
import { audit } from "@/lib/audit";
import {
  getOrCreateIntegration,
  registrationWebhookUrl,
  squareWebhookUrl,
  leadWebhookUrl,
} from "@/lib/integration";

export const dynamic = "force-dynamic";

const CHANNELS = ["ghl", "whatsapp", "email"];

async function scopedEvent(eventId: string) {
  const m = await getCurrentMembership();
  const event = await prisma.event.findFirst({
    where: { id: eventId, organizationId: m.organization.id },
    select: { id: true },
  });
  return { m, event };
}

// locationId do GHL para montar a URL do webhook de leads (org-level). Prefere
// o env single-tenant; senão, a conexão GHL da organização.
async function ghlLocationId(organizationId: string): Promise<string | null> {
  const env = process.env.GHL_LOCATION_ID?.trim();
  if (env) return env;
  const conn = await prisma.ghlConnection.findFirst({
    where: { organizationId },
    select: { locationId: true },
  });
  return conn?.locationId ?? null;
}

// Config da integração de inscrições/pagamentos do evento (F1).
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { m, event } = await scopedEvent(id);
  if (!event) return jsonError(404, "Evento não encontrado");

  const integ = await getOrCreateIntegration(id);
  const locId = await ghlLocationId(m.organization.id);
  return NextResponse.json({
    registrationUrl: registrationWebhookUrl(integ.registrationToken),
    squareUrl: squareWebhookUrl(integ.paymentToken),
    leadUrl: locId ? leadWebhookUrl(locId) : null,
    hasSignatureKey: Boolean(integ.squareSignatureKey),
    autoSendQrOnPaid: integ.autoSendQrOnPaid,
    sendChannel: integ.sendChannel,
    sendMsgOnRegistration: integ.sendMsgOnRegistration,
    registrationChannel: integ.registrationChannel,
    priceCents: integ.priceCents,
    currency: integ.currency,
    paymentReminderEnabled: integ.paymentReminderEnabled,
    paymentReminderMinutes: integ.paymentReminderMinutes,
    paymentReminderMessage: integ.paymentReminderMessage,
    active: integ.active,
    fieldMap: integ.fieldMap ?? null,
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { m, event } = await scopedEvent(id);
  if (!event) return jsonError(404, "Evento não encontrado");
  if (m.role === "member") return jsonError(403, "Sem permissão.");

  await getOrCreateIntegration(id);
  const body = await req.json().catch(() => ({}));
  const data: Record<string, unknown> = {};

  if (body.squareSignatureKey !== undefined) {
    const key = String(body.squareSignatureKey ?? "").trim();
    data.squareSignatureKey = key ? encryptSecret(key) : null;
  }
  if (body.autoSendQrOnPaid !== undefined)
    data.autoSendQrOnPaid = Boolean(body.autoSendQrOnPaid);
  if (body.sendChannel !== undefined && CHANNELS.includes(body.sendChannel))
    data.sendChannel = body.sendChannel;
  if (body.sendMsgOnRegistration !== undefined)
    data.sendMsgOnRegistration = Boolean(body.sendMsgOnRegistration);
  if (
    body.registrationChannel !== undefined &&
    ["whatsapp", "email"].includes(body.registrationChannel)
  )
    data.registrationChannel = body.registrationChannel;
  if (body.active !== undefined) data.active = Boolean(body.active);
  if (body.priceCents !== undefined)
    data.priceCents = body.priceCents === null || body.priceCents === ""
      ? null
      : Math.max(0, Math.round(Number(body.priceCents)));
  if (body.currency !== undefined && String(body.currency).trim())
    data.currency = String(body.currency).trim().toUpperCase().slice(0, 3);
  if (body.paymentReminderEnabled !== undefined)
    data.paymentReminderEnabled = Boolean(body.paymentReminderEnabled);
  if (body.paymentReminderMinutes !== undefined)
    data.paymentReminderMinutes = Math.max(1, Math.round(Number(body.paymentReminderMinutes) || 30));
  if (body.paymentReminderMessage !== undefined)
    data.paymentReminderMessage = body.paymentReminderMessage
      ? String(body.paymentReminderMessage)
      : null;
  if (body.fieldMap !== undefined)
    data.fieldMap = body.fieldMap && typeof body.fieldMap === "object" ? body.fieldMap : null;

  if (Object.keys(data).length === 0) return jsonError(400, "Nada para atualizar.");

  await prisma.eventIntegration.update({ where: { eventId: id }, data });
  await audit(m, "integration.update", id, { fields: Object.keys(data) });
  return NextResponse.json({ ok: true });
}
