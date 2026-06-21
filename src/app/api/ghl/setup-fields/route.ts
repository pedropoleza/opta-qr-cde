import { NextResponse } from "next/server";
import { getCurrentMembership, jsonError } from "@/lib/api";
import { GhlError, ensureGhlCustomFields } from "@/lib/ghl";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";

// Cria automaticamente os custom fields do Spark na location conectada, para o
// workflow do cliente ter todas as variáveis. Owner/gerente.
export async function POST() {
  const m = await getCurrentMembership();
  if (m.role === "member") return jsonError(403, "Sem permissão.");
  try {
    const result = await ensureGhlCustomFields(m.organization.id);
    await audit(m, "ghl.setup_fields", null, result);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message =
      err instanceof GhlError ? err.message : "Erro ao preparar os campos no Spark";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
