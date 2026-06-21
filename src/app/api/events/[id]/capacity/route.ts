import { NextRequest, NextResponse } from "next/server";
import { getCurrentOrgId, jsonError, findOrgEvent } from "@/lib/api";
import { capacityStatus, promoteWaitlist } from "@/lib/capacity";

export const dynamic = "force-dynamic";

// Status de capacidade/lista de espera do evento (#1).
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const organizationId = await getCurrentOrgId();
  const { id } = await params;
  const event = await findOrgEvent(id, organizationId);
  if (!event) return jsonError(404, "Evento não encontrado");
  return NextResponse.json(await capacityStatus(id));
}

// Promove convidados da lista de espera (respeita as vagas livres).
// Body opcional: { count }.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const organizationId = await getCurrentOrgId();
  const { id } = await params;
  const event = await findOrgEvent(id, organizationId);
  if (!event) return jsonError(404, "Evento não encontrado");
  const body = await req.json().catch(() => ({}));
  const count =
    body.count != null && Number.isFinite(Number(body.count))
      ? Math.max(1, Math.floor(Number(body.count)))
      : undefined;
  const promoted = await promoteWaitlist(id, count);
  return NextResponse.json({
    promoted: promoted.length,
    guests: promoted,
    status: await capacityStatus(id),
  });
}
