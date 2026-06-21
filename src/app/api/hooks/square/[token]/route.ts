import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { decryptSecret } from "@/lib/crypto";
import { verifySquareSignature, parseSquarePayment } from "@/lib/square";
import { squareWebhookUrl } from "@/lib/integration";
import { ensureTicket } from "@/lib/checkin";
import { enqueueQrDelivery } from "@/lib/delivery";
import { renderTemplate, buildContext, textToHtml } from "@/lib/templates";
import { enforceRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const PAID_STATUSES = ["COMPLETED", "APPROVED", "CAPTURED"];

// Webhook de pagamento do Square. Verifica a assinatura, casa o pagamento ao
// convidado (por reference_id ou e-mail) e dispara o QR quando configurado.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const limited = await enforceRateLimit(req, "hook-square", 240, 60, token);
  if (limited) return limited;

  const integration = await prisma.eventIntegration.findUnique({
    where: { paymentToken: token },
    include: {
      event: {
        select: {
          id: true,
          name: true,
          slug: true,
          date: true,
          locationName: true,
          address: true,
        },
      },
    },
  });
  if (!integration || !integration.active) {
    return NextResponse.json({ error: "Endpoint inválido" }, { status: 404 });
  }

  const raw = await req.text();

  // Verificação de assinatura (quando a chave já foi configurada).
  if (integration.squareSignatureKey) {
    const key = decryptSecret(integration.squareSignatureKey);
    const ok = verifySquareSignature(
      key,
      squareWebhookUrl(token),
      raw,
      req.headers.get("x-square-hmacsha256-signature"),
    );
    if (!ok) {
      return NextResponse.json({ error: "Assinatura inválida" }, { status: 401 });
    }
  }

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Corpo inválido" }, { status: 400 });
  }

  const payment = parseSquarePayment(body);
  if (!payment || !payment.externalId) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  // Idempotência: o Square reenvia. Se já vimos esse event_id, encerra.
  try {
    await prisma.webhookEvent.create({
      data: {
        provider: "square",
        externalId: payment.externalId,
        eventId: integration.event.id,
      },
    });
  } catch {
    return NextResponse.json({ ok: true, duplicate: true });
  }

  const event = integration.event;

  // Localiza o convidado: reference_id (id do convidado) tem prioridade; senão e-mail.
  let guest =
    payment.referenceId
      ? await prisma.guest.findFirst({
          where: { id: payment.referenceId, eventId: event.id },
        })
      : null;
  if (!guest && payment.email) {
    guest = await prisma.guest.findFirst({
      where: { eventId: event.id, email: { equals: payment.email, mode: "insensitive" } },
    });
  }
  if (!guest) {
    return NextResponse.json({ ok: true, matched: false });
  }

  if (payment.isRefund) {
    await prisma.guest.update({
      where: { id: guest.id },
      data: { paymentStatus: "refunded" },
    });
    return NextResponse.json({ ok: true, refunded: true });
  }

  if (!PAID_STATUSES.includes(payment.status)) {
    return NextResponse.json({ ok: true, status: payment.status, sent: false });
  }

  // Marca pago e (se configurado) dispara o QR pelo canal escolhido.
  const ticket = await ensureTicket(event.id, guest.id);
  const eventDate = event.date.toISOString().slice(0, 10);
  const location = event.locationName ?? event.address ?? "";

  // Template no-code de entrega do QR (F2), se houver.
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
      where: { id: guest!.id },
      data: {
        paymentStatus: "paid",
        amountPaid: payment.amount,
        currency: payment.currency,
        paidAt: new Date(),
        paymentRef: payment.paymentRef,
      },
    });
    if (!integration.autoSendQrOnPaid) return { queued: false, via: "off" };
    return enqueueQrDelivery(
      tx,
      { id: event.id, name: event.name, slug: event.slug, date: eventDate, location },
      {
        id: guest!.id,
        eventId: event.id,
        name: guest!.name,
        email: guest!.email,
        phone: guest!.phone,
        ghlContactId: guest!.ghlContactId,
        ticketId: ticket.id,
        token: ticket.token,
      },
      integration.sendChannel,
      overrides,
    );
  });

  return NextResponse.json({ ok: true, paid: true, delivery: result });
}
