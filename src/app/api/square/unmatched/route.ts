import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentOrgId, jsonError } from "@/lib/api";
import {
  listUnmatchedPayments,
  linkUnmatchedPayment,
} from "@/lib/square-payments";

export const dynamic = "force-dynamic";

// Pagamentos pagos que não casaram com nenhum convidado (fila de conciliação
// manual). Org-level: o pagamento não sabe o evento.
export async function GET() {
  await getCurrentOrgId(); // resolve/garante a organização (single-tenant)
  const payments = await listUnmatchedPayments();
  return NextResponse.json({ payments });
}

// Vincula um pagamento órfão a um convidado: settla (ticket + QR) e resolve.
export async function POST(req: NextRequest) {
  const organizationId = await getCurrentOrgId();
  const body = await req.json().catch(() => ({}));
  const paymentId = String(body.paymentId ?? "").trim();
  const guestId = String(body.guestId ?? "").trim();
  if (!paymentId || !guestId) {
    return jsonError(400, "Informe paymentId e guestId.");
  }

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
