import { NextResponse } from "next/server";
import { getCurrentOrgId, jsonError } from "@/lib/api";
import { isEmbedded } from "@/lib/embed-guard";
import { squareConfigured } from "@/lib/square-api";
import { syncSquareCatalog } from "@/lib/square-catalog";

export const dynamic = "force-dynamic";

// Sincroniza o catálogo do Square → eventos (nome + preço vêm do Square).
// Rota de painel (gated). Retorna um resumo do que foi criado/atualizado.
export async function POST() {
  if (!(await isEmbedded())) return jsonError(403, "Acesso restrito ao painel.");
  if (!squareConfigured()) return jsonError(503, "Square não configurado.");

  const organizationId = await getCurrentOrgId();
  const result = await syncSquareCatalog(organizationId);
  if (!result.ok) return NextResponse.json(result, { status: 502 });
  return NextResponse.json(result);
}
