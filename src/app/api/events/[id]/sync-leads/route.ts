import { NextRequest, NextResponse } from "next/server";
import { getCurrentOrgId, jsonError, findOrgEvent } from "@/lib/api";
import { syncEventLeadsByTag } from "@/lib/lead-sync";
import { GhlError } from "@/lib/ghl";

export const dynamic = "force-dynamic";

// Sincronização manual de leads por tag: puxa os contatos do Spark com a tag
// do evento e cria/atualiza os convidados com "Aguardando pagamento".
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const organizationId = await getCurrentOrgId();
  const { id } = await params;

  const event = await findOrgEvent(id, organizationId);
  if (!event) return jsonError(404, "Evento não encontrado");
  if (!event.ghlTag?.trim()) {
    return jsonError(
      400,
      "Defina a tag do evento em Configurações para importar leads por tag.",
    );
  }

  try {
    const result = await syncEventLeadsByTag(id);
    return NextResponse.json(result);
  } catch (err) {
    const message =
      err instanceof GhlError ? err.message : "Erro ao sincronizar leads do Spark";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
