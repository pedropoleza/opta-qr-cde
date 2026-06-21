import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/api";
import { enforceRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

// Busca do totem (#5): escopo do evento pelo kioskToken, sem PIN. Exige um termo
// mínimo para não despejar a lista inteira; devolve só o essencial.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const limited = await enforceRateLimit(req, "kiosk-search", 120, 60, token);
  if (limited) return limited;

  const event = await prisma.event.findUnique({
    where: { kioskToken: token },
    select: { id: true, status: true },
  });
  if (!event) return jsonError(404, "Totem inválido");

  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 3) return NextResponse.json({ guests: [] });

  const guests = await prisma.guest.findMany({
    where: {
      eventId: event.id,
      status: { not: "canceled" },
      waitlisted: false,
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
        { phone: { contains: q } },
      ],
    },
    orderBy: { name: "asc" },
    take: 15,
    include: { ticket: { select: { status: true } } },
  });

  return NextResponse.json({
    guests: guests.map((g) => ({
      id: g.id,
      name: g.name,
      tier: g.tier,
      vip: g.vip,
      checkedIn: g.ticket?.status === "checked_in",
    })),
  });
}
