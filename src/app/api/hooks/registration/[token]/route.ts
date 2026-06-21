import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { mapRegistration } from "@/lib/integration";
import { capacityStatus } from "@/lib/capacity";
import { enforceRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

// Webhook de inscrição (genérico). O formulário do cliente chama esta URL; o app
// cria/atualiza o convidado como "inscrito / pagamento pendente".
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const limited = await enforceRateLimit(req, "hook-registration", 120, 60, token);
  if (limited) return limited;

  const integration = await prisma.eventIntegration.findUnique({
    where: { registrationToken: token },
    include: { event: { select: { id: true, status: true } } },
  });
  if (!integration || !integration.active) {
    return NextResponse.json({ error: "Endpoint inválido" }, { status: 404 });
  }
  if (["completed", "canceled"].includes(integration.event.status)) {
    return NextResponse.json({ error: "Evento encerrado" }, { status: 400 });
  }

  const body = await readBody(req);
  const fields = mapRegistration(
    body,
    integration.fieldMap as Record<string, string> | null,
  );
  if (!fields.name && !fields.email) {
    return NextResponse.json({ error: "Informe ao menos nome ou e-mail" }, { status: 400 });
  }

  const eventId = integration.event.id;

  // Deduplica por e-mail dentro do evento.
  const existing = fields.email
    ? await prisma.guest.findFirst({
        where: { eventId, email: { equals: fields.email, mode: "insensitive" } },
      })
    : null;

  if (existing) {
    await prisma.guest.update({
      where: { id: existing.id },
      data: {
        name: fields.name ?? existing.name,
        phone: fields.phone ?? existing.phone,
        registrationRef: fields.ref ?? existing.registrationRef,
        paymentStatus: existing.paymentStatus === "paid" ? "paid" : "pending",
      },
    });
    return NextResponse.json({ ok: true, guestId: existing.id, deduped: true });
  }

  // Respeita capacidade (#1): se lotado, entra na lista de espera.
  const cap = await capacityStatus(eventId);
  const waitlisted = cap.available != null && cap.available <= 0;

  const guest = await prisma.guest.create({
    data: {
      eventId,
      name: fields.name ?? fields.email!.split("@")[0],
      email: fields.email,
      phone: fields.phone,
      source: "manual",
      status: "pending_qr",
      paymentStatus: "pending",
      registrationRef: fields.ref,
      waitlisted,
    },
  });

  return NextResponse.json({ ok: true, guestId: guest.id, waitlisted });
}

async function readBody(req: NextRequest): Promise<Record<string, unknown>> {
  const ct = req.headers.get("content-type") ?? "";
  try {
    if (ct.includes("application/json")) {
      return (await req.json()) as Record<string, unknown>;
    }
    if (ct.includes("application/x-www-form-urlencoded") || ct.includes("multipart/form-data")) {
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
