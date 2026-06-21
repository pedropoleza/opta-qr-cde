import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentOrgId, jsonError, findOrgEvent } from "@/lib/api";
import { enqueueAddTag } from "@/lib/ghl-sync";
import { capacityStatus } from "@/lib/capacity";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const organizationId = await getCurrentOrgId();
  const { id } = await params;

  const event = await findOrgEvent(id, organizationId);
  if (!event) return jsonError(404, "Evento não encontrado");

  const guests = await prisma.guest.findMany({
    where: { eventId: id },
    orderBy: { createdAt: "asc" },
    include: { ticket: { select: { id: true, token: true, signature: true, checkedInAt: true } } },
  });
  return NextResponse.json({ guests });
}

// Adição de convidados: importação CSV (lote) e adição manual (Etapa 2).
// Body: { guests: [{ name, email?, phone?, ghlContactId? }], source: "csv"|"manual"|"ghl" }
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const organizationId = await getCurrentOrgId();
  const { id } = await params;

  const event = await findOrgEvent(id, organizationId);
  if (!event) return jsonError(404, "Evento não encontrado");
  if (["completed", "canceled"].includes(event.status)) {
    return jsonError(400, "Evento encerrado não aceita novos convidados");
  }

  const body = await req.json();
  const source = ["csv", "manual", "ghl"].includes(body.source) ? body.source : "csv";
  const input: {
    name?: string;
    email?: string;
    phone?: string;
    ghlContactId?: string;
    tier?: string;
    companions?: number;
  }[] = Array.isArray(body.guests) ? body.guests : [];
  const valid = input.filter((g) => g.name && String(g.name).trim());
  if (valid.length === 0) return jsonError(400, "Nenhum convidado válido (nome é obrigatório)");

  // Capacidade & lista de espera (#1): quem passar do teto entra como waitlisted.
  const cap = await capacityStatus(id);
  let remaining = cap.available; // null = sem teto
  const takeSeat = () => {
    if (remaining == null) return false; // sem teto → sempre confirmado
    if (remaining > 0) {
      remaining -= 1;
      return false; // ainda há vaga → confirmado
    }
    return true; // lotado → lista de espera
  };

  const created = await prisma.$transaction(async (tx) => {
    const result = [];
    for (const g of valid) {
      const guest = await tx.guest.create({
        data: {
          eventId: id,
          name: String(g.name).trim(),
          email: g.email ? String(g.email).trim().toLowerCase() : null,
          phone: g.phone ? String(g.phone).trim() : null,
          tier: g.tier ? String(g.tier).trim() : null,
          ghlContactId: g.ghlContactId || null,
          source,
          status: "pending_qr",
          waitlisted: takeSeat(),
        },
      });
      // Tag convidado-{evento} ao incluir na lista (seção 3.5).
      await enqueueAddTag(
        tx,
        { id: guest.id, eventId: id, ghlContactId: guest.ghlContactId },
        `convidado-${event.slug}`
      );
      result.push(guest);

      // #4 Acompanhantes: cria N convidados no mesmo grupo do titular.
      const companions = Math.max(0, Math.min(20, Number(g.companions) || 0));
      if (companions > 0) {
        await tx.guest.update({
          where: { id: guest.id },
          data: { groupId: guest.id },
        });
        for (let k = 1; k <= companions; k++) {
          const comp = await tx.guest.create({
            data: {
              eventId: id,
              name: `${String(g.name).trim()} (acompanhante ${k})`,
              tier: g.tier ? String(g.tier).trim() : null,
              source,
              status: "pending_qr",
              groupId: guest.id,
              waitlisted: takeSeat(),
            },
          });
          result.push(comp);
        }
      }
    }
    return result;
  });

  return NextResponse.json({ created: created.length, guests: created }, { status: 201 });
}
