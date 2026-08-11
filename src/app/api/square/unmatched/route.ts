import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentOrgId, jsonError, findOrgEvent } from "@/lib/api";
import {
  listUnmatchedPayments,
  linkUnmatchedPayment,
  createGuestForUnmatchedPayment,
} from "@/lib/square-payments";

export const dynamic = "force-dynamic";

// Pagamentos pagos que não casaram com nenhum convidado (fila de conciliação
// manual). Org-level: o pagamento não sabe o evento.
export async function GET() {
  await getCurrentOrgId(); // resolve/garante a organização (single-tenant)
  const payments = await listUnmatchedPayments();
  return NextResponse.json({ payments });
}

// Resolve um pagamento órfão de duas formas (settla ticket + QR e resolve):
//  - { paymentId, guestId }        → vincula a um convidado já existente.
//  - { paymentId, eventId, name? } → cria o convidado no evento e vincula
//    (quem pagou nunca foi inscrito). name cai para o handle do e-mail.
export async function POST(req: NextRequest) {
  const organizationId = await getCurrentOrgId();
  const body = await req.json().catch(() => ({}));
  const paymentId = String(body.paymentId ?? "").trim();
  if (!paymentId) return jsonError(400, "Informe paymentId.");

  const guestId = String(body.guestId ?? "").trim();
  if (guestId) {
    // Garante que o convidado é da organização atual (isolamento).
    const guest = await prisma.guest.findFirst({
      where: { id: guestId, event: { organizationId } },
      select: { id: true },
    });
    if (!guest) return jsonError(404, "Convidado não encontrado.");

    const result = await linkUnmatchedPayment(paymentId, guestId);
    if (!result.ok) return jsonError(400, result.error ?? "Falha ao vincular.");
    return NextResponse.json({ ok: true, queued: result.queued, via: result.via });
  }

  const eventId = String(body.eventId ?? "").trim();
  if (eventId) {
    // Garante que o evento é da organização atual (isolamento).
    const event = await findOrgEvent(eventId, organizationId);
    if (!event) return jsonError(404, "Evento não encontrado.");

    const result = await createGuestForUnmatchedPayment(paymentId, eventId, {
      name: body.name,
      email: body.email,
      phone: body.phone,
    });
    if (!result.ok) return jsonError(400, result.error ?? "Falha ao criar contato.");
    return NextResponse.json({
      ok: true,
      guestId: result.guestId,
      queued: result.queued,
      via: result.via,
    });
  }

  return jsonError(400, "Informe guestId (vincular) ou eventId (criar contato).");
}
