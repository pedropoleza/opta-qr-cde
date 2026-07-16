import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  appBaseUrl,
  pickEventForAgenda,
  pickEventForTags,
} from "@/lib/integration";
import { ensureGuestPaymentLink, defaultOrgId } from "@/lib/square-payments";
import { logWebhook } from "@/lib/webhook-log";
import { enforceRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

// Redirect inteligente de pagamento. O formulário do evento pode apontar o
// "redirect ao enviar" para:
//   https://eventos.optafinance.com/pay?email={{contact.email}}&agenda=<evento>
// Aqui: acha/cria o convidado (Aguardando pagamento), gera o link inteligente do
// Square (reference_id = convidado) e redireciona pro checkout. Assim o
// pagamento chega 100% identificado.
export async function GET(req: NextRequest) {
  const limited = await enforceRateLimit(req, "pay-redirect", 120, 60);
  if (limited) return limited;

  const url = new URL(req.url);
  const email = url.searchParams.get("email")?.trim() || null;
  const phone = url.searchParams.get("phone")?.trim() || null;
  const name = url.searchParams.get("name")?.trim() || null;
  const agenda = url.searchParams.get("agenda")?.trim() || null;
  const tag = url.searchParams.get("tag")?.trim() || null;

  const organizationId = await defaultOrgId();
  if (!organizationId) return fail(req, "org");

  const events = await prisma.event.findMany({
    where: { organizationId },
    select: { id: true, name: true, date: true, status: true, ghlTag: true },
  });
  const event =
    (agenda && pickEventForAgenda(events, agenda)) ||
    (tag ? pickEventForTags(events, [tag]) : null);
  if (!event) {
    await logWebhook("pay", null, "no_match", {
      detail: `agenda="${agenda ?? ""}" tag="${tag ?? ""}"`,
    });
    return fail(req, "event");
  }

  // Acha/cria o convidado (dedupe por e-mail/telefone).
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
  if (!guest) return fail(req, "guest");

  const link = await ensureGuestPaymentLink(guest.id).catch(() => null);
  if (!link) {
    // Sem preço/Square configurado: cai no fallback geral, se houver.
    const fallback = process.env.SQUARE_GENERAL_CHECKOUT_URL?.trim();
    if (fallback) return NextResponse.redirect(fallback, 302);
    await logWebhook("pay", null, "off", { detail: `guest=${guest.id} sem link` });
    return fail(req, "link");
  }

  await logWebhook("pay", null, "queued", { detail: `guest=${guest.id} → checkout` });
  return NextResponse.redirect(link, 302);
}

function fail(req: NextRequest, reason: string) {
  // Em caso de falha, leva o usuário à home em vez de mostrar erro cru.
  return NextResponse.redirect(`${appBaseUrl()}/?pay_error=${reason}`, 302);
}
