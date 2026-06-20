import { NextRequest, NextResponse } from "next/server";
import { getCurrentOrgId, jsonError, findOrgEvent } from "@/lib/api";
import { getEventTicketConfig, saveTicketTemplate } from "@/lib/ticket-config";
import { resolveTicketConfig } from "@/lib/ticket-template";

export const dynamic = "force-dynamic";

// Carrega o modelo do ingresso resolvido para o evento (com a origem).
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const organizationId = await getCurrentOrgId();
  const { id } = await params;
  const event = await findOrgEvent(id, organizationId);
  if (!event) return jsonError(404, "Evento não encontrado");

  const { config, scope } = await getEventTicketConfig(id);
  return NextResponse.json({ config, scope });
}

// Salva o modelo: scope "org" (padrão da organização) ou "event" (override).
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const organizationId = await getCurrentOrgId();
  const { id } = await params;
  const event = await findOrgEvent(id, organizationId);
  if (!event) return jsonError(404, "Evento não encontrado");

  const body = await req.json().catch(() => ({}));
  const config = resolveTicketConfig(body.config ?? null);
  const scope = body.scope === "org" ? "org" : "event";

  await saveTicketTemplate(organizationId, scope === "org" ? null : id, config);
  return NextResponse.json({ ok: true, scope });
}
