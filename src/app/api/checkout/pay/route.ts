import { NextRequest, NextResponse } from "next/server";
import { createPayment, squareCheckoutConfigured, SquareError } from "@/lib/square-api";
import { resolveCheckout } from "@/lib/checkout";
import { settlePaidGuest } from "@/lib/square-payments";
import { logWebhook } from "@/lib/webhook-log";
import { enforceRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

// Cobra o token do Web Payments SDK (cartão/wallet) e fecha o ciclo: marca o
// convidado como pago e dispara o ingresso (mesmo caminho do webhook do Square).
// O VALOR é recalculado no servidor a partir do evento — o corpo do cliente
// nunca define quanto cobrar.
export async function POST(req: NextRequest) {
  const limited = await enforceRateLimit(req, "checkout-pay", 30, 60);
  if (limited) return limited;

  if (!squareCheckoutConfigured()) {
    return NextResponse.json({ ok: false, error: "unconfigured" }, { status: 503 });
  }

  const body = await req.json().catch(() => ({}));
  const sourceId = typeof body.sourceId === "string" ? body.sourceId : "";
  const verificationToken =
    typeof body.verificationToken === "string" ? body.verificationToken : null;
  if (!sourceId) {
    return NextResponse.json({ ok: false, error: "missing_source" }, { status: 400 });
  }

  const res = await resolveCheckout({
    eventId: typeof body.eventId === "string" ? body.eventId : body.e,
    email: body.email,
    phone: body.phone,
    name: body.name,
    agenda: body.agenda,
    tag: body.tag,
  });
  if (!res.ok) {
    await logWebhook("checkout", null, "fail", { detail: `resolve=${res.reason}` }).catch(
      () => {},
    );
    return NextResponse.json({ ok: false, error: res.reason }, { status: 422 });
  }
  const ctx = res.ctx;

  let payment;
  try {
    payment = await createPayment({
      sourceId,
      amountCents: ctx.amountCents,
      currency: ctx.currency,
      // Chave por token (single-use) → retentativa de outro cartão gera cobrança
      // nova; reenvio do mesmo token é idempotente.
      idempotencyKey: `co-${sourceId}`,
      referenceId: ctx.guestId,
      buyerEmail: ctx.buyerEmail,
      verificationToken,
      note: ctx.eventName,
    });
  } catch (err) {
    const detail = err instanceof SquareError ? err.message : "erro";
    await logWebhook("checkout", null, "fail", {
      detail: `guest=${ctx.guestId} charge="${detail}"`,
    }).catch(() => {});
    return NextResponse.json({ ok: false, error: detail }, { status: 402 });
  }

  const paid = payment.status === "COMPLETED" || payment.status === "APPROVED";
  if (!paid) {
    await logWebhook("checkout", null, "pending", {
      detail: `guest=${ctx.guestId} status=${payment.status}`,
    }).catch(() => {});
    return NextResponse.json({ ok: false, error: "not_completed", status: payment.status });
  }

  // Cobrança OK → marca pago + enfileira o ingresso (idempotente).
  await settlePaidGuest(ctx.guestId, {
    amount: ctx.amountCents,
    currency: ctx.currency,
    paymentRef: payment.id,
  }).catch(() => {});
  await logWebhook("checkout", null, "queued", {
    detail: `guest=${ctx.guestId} payment=${payment.id}`,
  }).catch(() => {});

  return NextResponse.json({ ok: true, status: payment.status, receiptUrl: payment.receiptUrl });
}
