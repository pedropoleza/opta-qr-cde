import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentOrgId } from "@/lib/api";
import {
  GhlError,
  ghlConfigured,
  ghlListContacts,
  ghlSearchContactsByTag,
} from "@/lib/ghl";

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
  const tag = sp.get("tag")?.trim();
  try {
    // Filtro por tag (busca dedicada do Spark) ou listagem/busca por texto.
    let contacts;
    let startAfter: string | undefined;
    let startAfterId: string | undefined;
    if (tag) {
      contacts = await ghlSearchContactsByTag(organizationId, tag);
    } else {
      const res = await ghlListContacts(organizationId, {
        query: sp.get("query") || undefined,
        startAfter: sp.get("startAfter") || undefined,
        startAfterId: sp.get("startAfterId") || undefined,
        limit: 25,
      });
      contacts = res.contacts;
      startAfter = res.startAfter;
      startAfterId = res.startAfterId;
    }

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
      next: !tag && startAfterId ? { startAfter, startAfterId } : null,
    });
  } catch (err) {
    const message =
      err instanceof GhlError ? err.message : "Erro ao buscar contatos no Spark";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
