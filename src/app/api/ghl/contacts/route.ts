import { NextRequest, NextResponse } from "next/server";
import { GhlError, getGhlConfig, ghlSearchContactsByTag } from "@/lib/ghl";

export const dynamic = "force-dynamic";

// Pré-visualização de contatos do Spark por tag (#9), para seleção antes de
// importar como convidados.
export async function GET(req: NextRequest) {
  const tag = new URL(req.url).searchParams.get("tag")?.trim();
  if (!tag) {
    return NextResponse.json({ error: "Informe uma tag" }, { status: 400 });
  }
  if (!getGhlConfig().configured) {
    return NextResponse.json(
      { error: "Spark não conectado. Configure o token na aba Conexão." },
      { status: 400 },
    );
  }
  try {
    const contacts = await ghlSearchContactsByTag(tag);
    return NextResponse.json({ contacts, total: contacts.length });
  } catch (err) {
    const message =
      err instanceof GhlError ? err.message : "Erro ao buscar contatos no Spark";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
