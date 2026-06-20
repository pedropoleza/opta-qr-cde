import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { getCurrentOrgId, jsonError, findOrgEvent } from "@/lib/api";
import { slugify } from "@/lib/slug";

// Duplica a configuração do evento (nome, data, local, capacidade) como um novo
// rascunho. NÃO copia convidados, tickets nem logs. Gera novo slug e nova
// credencial de Checker (token + PIN).
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const organizationId = await getCurrentOrgId();
  const { id } = await params;

  const source = await findOrgEvent(id, organizationId);
  if (!source) return jsonError(404, "Evento não encontrado");

  const name = `${source.name} (cópia)`;
  const copy = await prisma.event.create({
    data: {
      organizationId,
      name,
      slug: slugify(name),
      date: source.date,
      startTime: source.startTime,
      endTime: source.endTime,
      locationName: source.locationName,
      address: source.address,
      capacity: source.capacity,
      status: "draft",
      checkerToken: Buffer.from(randomUUID()).toString("base64url"),
      checkerPin: String(Math.floor(100000 + Math.random() * 900000)),
    },
  });

  return NextResponse.json({ event: { id: copy.id } }, { status: 201 });
}
