import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentOrgId } from "@/lib/api";
import { GhlError, ghlConfigured, ghlListContacts } from "@/lib/ghl";

export const dynamic = "force-dynamic";

// Lista/busca contatos do Spark e cruza com os convidados locais para mostrar
// em quais eventos cada contato já está.
export async function GET(req: NextRequest) {
  const organizationId = await getCurrentOrgId();
  if (!(await ghlConfigured(organizationId))) {
    return NextResponse.json(
      { error: "Spark não conectado. Configure o token na aba Conexão." },
      { status: 400 },
    );
  }

  const sp = new URL(req.url).searchParams;
  try {
    const { contacts, startAfter, startAfterId } = await ghlListContacts(
      organizationId,
      {
        query: sp.get("query") || undefined,
        startAfter: sp.get("startAfter") || undefined,
        startAfterId: sp.get("startAfterId") || undefined,
        limit: 25,
      },
    );

    const ids = contacts.map((c) => c.id);
    const guests = ids.length
      ? await prisma.guest.findMany({
          where: {
            ghlContactId: { in: ids },
            status: { not: "canceled" },
            event: { organizationId },
          },
          select: {
            ghlContactId: true,
            status: true,
            event: { select: { id: true, name: true } },
          },
        })
      : [];

    const byContact = new Map<
      string,
      { id: string; name: string; status: string }[]
    >();
    for (const g of guests) {
      if (!g.ghlContactId) continue;
      const arr = byContact.get(g.ghlContactId) ?? [];
      arr.push({ id: g.event.id, name: g.event.name, status: g.status });
      byContact.set(g.ghlContactId, arr);
    }

    const withEvents = contacts.map((c) => ({
      ...c,
      events: byContact.get(c.id) ?? [],
    }));

    return NextResponse.json({
      contacts: withEvents,
      next: startAfterId ? { startAfter, startAfterId } : null,
    });
  } catch (err) {
    const message =
      err instanceof GhlError ? err.message : "Erro ao buscar contatos no Spark";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
