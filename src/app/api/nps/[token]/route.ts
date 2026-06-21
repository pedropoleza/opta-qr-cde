import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/api";
import { enqueueAddTag } from "@/lib/ghl-sync";
import { enforceRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

function bucket(score: number): "promotor" | "neutro" | "detrator" {
  if (score >= 9) return "promotor";
  if (score >= 7) return "neutro";
  return "detrator";
}

// Pesquisa/NPS (#9). Pública pelo token do ingresso (segredo do convidado).
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const limited = await enforceRateLimit(req, "nps", 20, 60);
  if (limited) return limited;

  const body = await req.json().catch(() => ({}));
  const score = Number(body.score);
  if (!Number.isInteger(score) || score < 0 || score > 10) {
    return jsonError(400, "Nota inválida (0 a 10).");
  }
  const comment = body.comment ? String(body.comment).trim().slice(0, 1000) : null;

  const ticket = await prisma.ticket.findUnique({
    where: { token },
    select: {
      guestId: true,
      eventId: true,
      event: { select: { slug: true } },
      guest: { select: { ghlContactId: true } },
    },
  });
  if (!ticket) return jsonError(404, "Ingresso não encontrado");

  await prisma.$transaction(async (tx) => {
    await tx.guest.update({
      where: { id: ticket.guestId },
      data: { npsScore: score, npsComment: comment, npsAt: new Date() },
    });
    await enqueueAddTag(
      tx,
      {
        id: ticket.guestId,
        eventId: ticket.eventId,
        ghlContactId: ticket.guest.ghlContactId,
      },
      `nps-${bucket(score)}-${ticket.event.slug}`,
    );
  });

  return NextResponse.json({ ok: true });
}
