import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentOrgId, jsonError, findOrgEvent } from "@/lib/api";

// Importa contatos do Spark/GHL como convidados (#9), com ghl_contact_id —
// assim o workflow de e-mail consegue disparar para eles. Deduplica por
// ghl_contact_id dentro do evento.
type IncomingContact = {
  ghlContactId?: string;
  id?: string;
  name?: string;
  email?: string | null;
  phone?: string | null;
};

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const organizationId = await getCurrentOrgId();
  const { id } = await params;

  const event = await findOrgEvent(id, organizationId);
  if (!event) return jsonError(404, "Evento não encontrado");

  const body = await req.json().catch(() => ({}));
  const contacts: IncomingContact[] = Array.isArray(body.contacts)
    ? body.contacts
    : [];
  if (contacts.length === 0) {
    return jsonError(400, "Nenhum contato selecionado");
  }

  const ids = contacts
    .map((c) => c.ghlContactId ?? c.id)
    .filter((v): v is string => Boolean(v));

  const existing = await prisma.guest.findMany({
    where: { eventId: id, ghlContactId: { in: ids } },
    select: { ghlContactId: true },
  });
  const seen = new Set(existing.map((e) => e.ghlContactId));

  let skipped = 0;
  const toCreate = [];
  for (const c of contacts) {
    const ghlContactId = c.ghlContactId ?? c.id;
    const name = (c.name ?? "").trim();
    if (!ghlContactId || !name || seen.has(ghlContactId)) {
      skipped++;
      continue;
    }
    seen.add(ghlContactId);
    toCreate.push({
      eventId: id,
      ghlContactId,
      name,
      email: c.email || null,
      phone: c.phone || null,
      source: "ghl",
      status: "pending_qr",
    });
  }

  if (toCreate.length > 0) {
    await prisma.guest.createMany({ data: toCreate });
  }

  return NextResponse.json({ created: toCreate.length, skipped });
}
