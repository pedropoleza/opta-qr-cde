import { NextRequest, NextResponse } from "next/server";
import { getCurrentMembership, getCurrentOrgId, jsonError } from "@/lib/api";
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
  const m = await getCurrentMembership();
  if (m.role === "member") return jsonError(403, "Sem permissão para conectar.");
  const organizationId = m.organization.id;
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
  const m = await getCurrentMembership();
  if (m.role === "member") return jsonError(403, "Sem permissão para desconectar.");
  await deleteGhlConnection(m.organization.id);
  return NextResponse.json({ ok: true });
}
