import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentOrgId, jsonError, findOrgEvent } from "@/lib/api";
import { settlePaidGuest } from "@/lib/square-payments";

// Atualiza dados do convidado (hoje: categoria/tier — #5).
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; guestId: string }> },
) {
  const organizationId = await getCurrentOrgId();
  const { id, guestId } = await params;

  const event = await findOrgEvent(id, organizationId);
  if (!event) return jsonError(404, "Evento não encontrado");

  const guest = await prisma.guest.findFirst({ where: { id: guestId, eventId: id } });
  if (!guest) return jsonError(404, "Convidado não encontrado");

  const body = await req.json().catch(() => ({}));

  // "Marcar pago" na mão deve SETTLAR de verdade (emitir ticket + disparar o QR),
  // igual ao caminho automático do webhook/conciliação — não só trocar o status.
  const wantsPaid =
    "paymentStatus" in body && String(body.paymentStatus) === "paid";

  const data: {
    tier?: string | null;
    sessionId?: string | null;
    name?: string;
    vip?: boolean;
    language?: string;
    paymentStatus?: string;
  } = {};
  if ("language" in body) {
    data.language = String(body.language || "pt_BR");
  }
  // Transições que NÃO são "paid" continuam sendo simples troca de status.
  if ("paymentStatus" in body && !wantsPaid) {
    const ps = String(body.paymentStatus);
    if (["none", "pending", "refunded", "failed"].includes(ps)) {
      data.paymentStatus = ps;
    }
  }
  if ("tier" in body) {
    data.tier = body.tier ? String(body.tier).trim() : null;
  }
  if ("sessionId" in body) {
    data.sessionId = body.sessionId ? String(body.sessionId) : null;
  }
  if ("name" in body) {
    const name = String(body.name ?? "").trim();
    if (!name) return jsonError(400, "O nome não pode ficar vazio.");
    data.name = name;
  }
  if ("vip" in body) {
    data.vip = Boolean(body.vip);
  }

  const updated = Object.keys(data).length
    ? await prisma.guest.update({ where: { id: guestId }, data })
    : guest;

  // Settla o pagamento manual (idempotente: se já estava pago, é no-op).
  let settled: Awaited<ReturnType<typeof settlePaidGuest>> | undefined;
  if (wantsPaid && guest.paymentStatus !== "paid") {
    const integ = await prisma.eventIntegration.findUnique({
      where: { eventId: id },
      select: { priceCents: true, currency: true },
    });
    settled = await settlePaidGuest(guestId, {
      amount: integ?.priceCents ?? null,
      currency: integ?.currency ?? null,
      paymentRef: "manual",
    });
  }

  return NextResponse.json({
    ok: true,
    name: updated.name,
    tier: updated.tier,
    sessionId: updated.sessionId,
    vip: updated.vip,
    language: updated.language,
    paymentStatus: wantsPaid ? "paid" : updated.paymentStatus,
    settled: settled
      ? {
          queued: settled.queued ?? false,
          via: settled.via ?? null,
          alreadyPaid: settled.alreadyPaid ?? false,
        }
      : undefined,
  });
}

// Remoção de convidado (ação manual do organizador — seção 2.1: canceled).
// O ticket correspondente também é cancelado: o QR passa a responder Vermelho.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; guestId: string }> }
) {
  const organizationId = await getCurrentOrgId();
  const { id, guestId } = await params;

  const event = await findOrgEvent(id, organizationId);
  if (!event) return jsonError(404, "Evento não encontrado");

  const guest = await prisma.guest.findFirst({ where: { id: guestId, eventId: id } });
  if (!guest) return jsonError(404, "Convidado não encontrado");

  await prisma.$transaction([
    prisma.guest.update({ where: { id: guestId }, data: { status: "canceled" } }),
    prisma.ticket.updateMany({
      where: { guestId, status: { not: "checked_in" } },
      data: { status: "canceled" },
    }),
  ]);

  return NextResponse.json({ ok: true });
}
