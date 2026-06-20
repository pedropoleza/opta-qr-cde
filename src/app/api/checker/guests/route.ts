import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCheckerSession } from "@/lib/auth";
import { jsonError } from "@/lib/api";

export const dynamic = "force-dynamic";

// #1 Busca de convidados pelo Checker (escopo do evento, via sessão de PIN).
export async function GET(req: NextRequest) {
  const checker = await getCheckerSession();
  if (!checker) return jsonError(401, "Sessão de Checker necessária");

  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  const guests = await prisma.guest.findMany({
    where: {
      eventId: checker.eventId,
      status: { not: "canceled" },
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { email: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: { name: "asc" },
    take: 40,
    include: { ticket: { select: { status: true, checkedInAt: true } } },
  });

  // #4 Tamanho do grupo para os resultados que pertencem a um grupo.
  const keys = [...new Set(guests.map((g) => g.groupId).filter(Boolean))] as string[];
  const countByKey = new Map<string, number>();
  if (keys.length) {
    const grouped = await prisma.guest.groupBy({
      by: ["groupId"],
      where: { groupId: { in: keys }, status: { not: "canceled" } },
      _count: { _all: true },
    });
    for (const row of grouped) {
      if (row.groupId) countByKey.set(row.groupId, row._count._all);
    }
  }

  return NextResponse.json({
    guests: guests.map((g) => ({
      id: g.id,
      name: g.name,
      email: g.email,
      tier: g.tier,
      groupSize: g.groupId ? (countByKey.get(g.groupId) ?? 1) : 1,
      checkedIn: g.ticket?.status === "checked_in",
      checkedInAt: g.ticket?.checkedInAt?.toISOString() ?? null,
    })),
  });
}
