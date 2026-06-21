import { NextRequest, NextResponse } from "next/server";
import { getCurrentOrgId } from "@/lib/api";
import { GhlError, ghlConfigured, ghlSearchContactsByTag } from "@/lib/ghl";

export const dynamic = "force-dynamic";

// Pré-visualização de contatos do Spark por tag (#9), para seleção antes de
// importar como convidados.
export async function GET(req: NextRequest) {
  const organizationId = await getCurrentOrgId();
  const tag = new URL(req.url).searchParams.get("tag")?.trim();
  if (!tag) {
    return NextResponse.json({ error: "Informe uma tag" }, { status: 400 });
  }
  if (!(await ghlConfigured(organizationId))) {
    return NextResponse.json(
      { error: "Spark não conectado. Configure o token na aba Conexão." },
      { status: 400 },
    );
  }
  try {
    const contacts = await ghlSearchContactsByTag(organizationId, tag);
    return NextResponse.json({ contacts, total: contacts.length });
  } catch (err) {
    const message =
      err instanceof GhlError ? err.message : "Erro ao buscar contatos no Spark";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
