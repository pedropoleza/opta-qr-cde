import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifySquareSignatureAny, parseSquarePayment } from "@/lib/square";
import { appBaseUrl } from "@/lib/integration";
import { cleanEnv } from "@/lib/ghl";
import { logWebhook } from "@/lib/webhook-log";
import { enforceRateLimit } from "@/lib/rate-limit";
import {
  PAID_STATUSES,
  matchGuestForPayment,
  settlePaidGuest,
  defaultOrgId,
} from "@/lib/square-payments";

export const dynamic = "force-dynamic";

// Webhook ORG-LEVEL do Square (uma URL para todos os eventos). Verifica a
// assinatura (env SQUARE_WEBHOOK_SIGNATURE_KEY), casa o pagamento ao convidado
// por reference_id/order_id (link inteligente) ou por e-mail/valor (busca
// inteligente) e marca pago + dispara o QR por e-mail.
export async function POST(req: NextRequest) {
  const limited = await enforceRateLimit(req, "hook-square-org", 480, 60);
  if (limited) return limited;

  const raw = await req.text();
  const sigKey = cleanEnv(process.env.SQUARE_WEBHOOK_SIGNATURE_KEY);

  // Enquanto a signature key não estiver configurada, respondemos 200 (no-op)
  // para o Square não desativar a subscription por falhas.
  if (!sigKey) {
    await logWebhook("square-org", null, "off", { detail: "sem signature key (env)" });
    return NextResponse.json({ ok: true, configured: false });
  }

  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "";
  const requestUrl = host ? `${proto}://${host}/api/square/webhook` : null;
  const ok = verifySquareSignatureAny(
    sigKey,
    [`${appBaseUrl()}/api/square/webhook`, requestUrl],
    raw,
    req.headers.get("x-square-hmacsha256-signature"),
  );
  if (!ok) {
    await logWebhook("square-org", null, "bad_signature", {
      detail: req.headers.get("x-square-hmacsha256-signature")
        ? "assinatura não confere"
        : "sem header de assinatura",
    });
    return NextResponse.json({ error: "Assinatura inválida" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    await logWebhook("square-org", null, "invalid_body");
    return NextResponse.json({ error: "Corpo inválido" }, { status: 400 });
  }

  const payment = parseSquarePayment(body);
  if (!payment || !payment.externalId) {
    await logWebhook("square-org", null, "ignored", {
      eventType: (body as { type?: string })?.type ?? null,
    });
    return NextResponse.json({ ok: true, ignored: true });
  }

  // Idempotência: o Square reenvia o mesmo event_id.
  try {
    await prisma.webhookEvent.create({
      data: { provider: "square", externalId: payment.externalId },
    });
  } catch {
    await logWebhook("square-org", null, "duplicate", { eventType: payment.type });
    return NextResponse.json({ ok: true, duplicate: true });
  }

  const organizationId = await defaultOrgId();
  if (!organizationId) {
    await logWebhook("square-org", null, "no_integration");
    return NextResponse.json({ ok: true, matched: false });
  }

  // Para casar por order_id precisamos do order_id do pagamento (o parser básico
  // não o extrai); lemos direto do payload aqui.
  const orderId = extractOrderId(body);
  const guest = await matchGuestForPayment(organizationId, {
    referenceId: payment.referenceId,
    orderId,
    email: payment.email,
    amount: payment.amount,
  });
  if (!guest) {
    await logWebhook("square-org", null, "no_match", {
      eventType: payment.type,
      detail: `ref=${payment.referenceId ?? "-"} order=${orderId ?? "-"} email=${payment.email ?? "-"}`,
    });
    return NextResponse.json({ ok: true, matched: false });
  }

  if (payment.isRefund) {
    await prisma.guest.update({
      where: { id: guest.id },
      data: { paymentStatus: "refunded" },
    });
    await logWebhook("square-org", null, "refunded", { eventType: payment.type });
    return NextResponse.json({ ok: true, refunded: true });
  }

  if (!PAID_STATUSES.includes(payment.status)) {
    await logWebhook("square-org", null, "not_paid", {
      eventType: payment.type,
      detail: `status=${payment.status}`,
    });
    return NextResponse.json({ ok: true, status: payment.status, sent: false });
  }

  const settled = await settlePaidGuest(guest.id, {
    amount: payment.amount,
    currency: payment.currency,
    paymentRef: payment.paymentRef,
  });
  await logWebhook("square-org", null, settled.alreadyPaid ? "duplicate" : "queued", {
    eventType: payment.type,
    detail: `guest=${guest.id} via=${settled.via ?? "-"}`,
  });
  return NextResponse.json({ ok: true, paid: true, settled });
}

function extractOrderId(body: unknown): string | null {
  const b = body as Record<string, unknown>;
  const data = (b?.data ?? {}) as Record<string, unknown>;
  const object = (data.object ?? {}) as Record<string, unknown>;
  const payment = (object.payment ?? object.refund ?? {}) as Record<string, unknown>;
  return (payment.order_id as string | undefined) ?? null;
}
