import { NextRequest, NextResponse } from "next/server";
import { getCurrentOrgId, jsonError } from "@/lib/api";
import {
  checkGhlConnection,
  deleteGhlConnection,
  saveGhlConnection,
} from "@/lib/ghl";

export const dynamic = "force-dynamic";

// Status da conexão GHL da organização.
export async function GET() {
  const organizationId = await getCurrentOrgId();
  return NextResponse.json(await checkGhlConnection(organizationId));
}

// Conecta/atualiza: salva o Private Integration Token (cifrado) da org e testa.
export async function POST(req: NextRequest) {
  const organizationId = await getCurrentOrgId();
  const body = await req.json().catch(() => ({}));
  const token = String(body.token ?? "").trim();
  const locationId = String(body.locationId ?? "").trim();
  if (!token || !locationId) {
    return jsonError(400, "Informe o Location ID e o token.");
  }
  await saveGhlConnection(organizationId, locationId, token);
  return NextResponse.json(await checkGhlConnection(organizationId));
}

// Desconecta: remove a conexão da organização.
export async function DELETE() {
  const organizationId = await getCurrentOrgId();
  await deleteGhlConnection(organizationId);
  return NextResponse.json({ ok: true });
}
