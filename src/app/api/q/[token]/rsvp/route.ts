import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/api";
import { enqueueAddTag } from "@/lib/ghl-sync";
import { enforceRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

// #10 RSVP do convidado (público — o token é o segredo dele). Marca a confirmação
// e aplica a tag de RSVP no contato (para automação no GHL).
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const limited = await enforceRateLimit(req, "rsvp", 20, 60);
  if (limited) return limited;

  const { token } = await params;
  const body = await req.json().catch(() => ({}));
  const rsvp = body.rsvp === "yes" ? "yes" : body.rsvp === "no" ? "no" : null;
  if (!rsvp) return jsonError(400, "RSVP inválido");

  const ticket = await prisma.ticket.findUnique({
    where: { token },
    include: { guest: true, event: { select: { slug: true } } },
  });
  if (!ticket || ticket.status === "canceled") {
    return jsonError(404, "Ingresso não encontrado");
  }

  await prisma.$transaction(async (tx) => {
    await tx.guest.update({
      where: { id: ticket.guestId },
      data: { rsvp },
    });
    await enqueueAddTag(
      tx,
      {
        id: ticket.guestId,
        eventId: ticket.eventId,
        ghlContactId: ticket.guest.ghlContactId,
      },
      `rsvp-${rsvp === "yes" ? "sim" : "nao"}-${ticket.event.slug}`,
    );
  });

  return NextResponse.json({ ok: true, rsvp });
}
