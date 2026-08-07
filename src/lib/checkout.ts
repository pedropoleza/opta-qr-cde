import { prisma } from "@/lib/prisma";
import { pickEventForAgenda, pickEventForTags } from "@/lib/integration";
import { defaultOrgId } from "@/lib/square-payments";

// Resolve o contexto de cobrança da modal a partir do que o formulário passa
// (e-mail + agenda). O VALOR vem sempre daqui (server-side), a partir do preço
// do evento — o cliente nunca envia/edita o valor. Reaproveita o casamento por
// agenda/tag e o dedupe de convidado usados no /pay.

export type CheckoutParams = {
  email?: string | null;
  phone?: string | null;
  name?: string | null;
  agenda?: string | null;
  tag?: string | null;
};

export type CheckoutContext = {
  guestId: string;
  eventId: string;
  eventName: string;
  amountCents: number;
  currency: string;
  buyerEmail: string | null;
};

export type CheckoutResolution =
  | { ok: true; ctx: CheckoutContext }
  | { ok: false; reason: "org" | "event" | "price" | "guest" };

export async function resolveCheckout(
  params: CheckoutParams,
): Promise<CheckoutResolution> {
  const email = params.email?.trim() || null;
  const phone = params.phone?.trim() || null;
  const name = params.name?.trim() || null;
  const agenda = params.agenda?.trim() || null;
  const tag = params.tag?.trim() || null;

  const organizationId = await defaultOrgId();
  if (!organizationId) return { ok: false, reason: "org" };

  const events = await prisma.event.findMany({
    where: { organizationId },
    select: {
      id: true,
      name: true,
      date: true,
      status: true,
      ghlTag: true,
      integration: { select: { priceCents: true, currency: true } },
    },
  });

  const event =
    (agenda && pickEventForAgenda(events, agenda)) ||
    (tag ? pickEventForTags(events, [tag]) : null);
  if (!event) return { ok: false, reason: "event" };

  const priceCents = event.integration?.priceCents ?? null;
  if (!priceCents || priceCents <= 0) return { ok: false, reason: "price" };
  const currency = event.integration?.currency ?? "USD";

  // Acha/cria o convidado (dedupe por e-mail/telefone) — mesma regra do /pay.
  let guest = await prisma.guest.findFirst({
    where: {
      eventId: event.id,
      OR: [
        email ? { email: { equals: email, mode: "insensitive" } } : undefined,
        phone ? { phone } : undefined,
      ].filter(Boolean) as object[],
    },
  });
  if (!guest && (email || phone || name)) {
    guest = await prisma.guest.create({
      data: {
        eventId: event.id,
        name: name ?? email?.split("@")[0] ?? "Convidado",
        email,
        phone,
        source: "ghl",
        status: "pending_qr",
        paymentStatus: "pending",
      },
    });
  }
  if (!guest) return { ok: false, reason: "guest" };

  return {
    ok: true,
    ctx: {
      guestId: guest.id,
      eventId: event.id,
      eventName: event.name,
      amountCents: priceCents,
      currency,
      buyerEmail: guest.email,
    },
  };
}
