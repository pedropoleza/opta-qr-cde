import { NextRequest, NextResponse } from "next/server";
import { getCurrentOrgId } from "@/lib/api";
import {
  GhlError,
  ghlConfigured,
  ghlSearchContactsByTag,
  ghlRecentContacts,
} from "@/lib/ghl";

export const dynamic = "force-dynamic";

// Pré-visualização de contatos do Spark por tag (#9) ou os mais recentes
// (?recent=N), para seleção antes de importar como convidados.
export async function GET(req: NextRequest) {
  const organizationId = await getCurrentOrgId();
  const url = new URL(req.url);
  const tag = url.searchParams.get("tag")?.trim();
  const recent = url.searchParams.get("recent");

  if (!tag && recent == null) {
    return NextResponse.json({ error: "Informe uma tag ou recent" }, { status: 400 });
  }
  if (!(await ghlConfigured(organizationId))) {
    return NextResponse.json(
      { error: "Spark não conectado. Configure o token na aba Conexão." },
      { status: 400 },
    );
  }
  try {
    const contacts = recent != null
      ? await ghlRecentContacts(
          organizationId,
          Math.min(50, Math.max(1, Number(recent) || 20)),
        )
      : await ghlSearchContactsByTag(organizationId, tag!);
    return NextResponse.json({ contacts, total: contacts.length });
  } catch (err) {
    const message =
      err instanceof GhlError ? err.message : "Erro ao buscar contatos no Spark";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
