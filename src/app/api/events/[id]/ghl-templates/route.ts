import { NextRequest, NextResponse } from "next/server";
import { getCurrentOrgId } from "@/lib/api";
import { ghlConfigured, ghlListTemplates } from "@/lib/ghl";

export const dynamic = "force-dynamic";

// Lista os templates de e-mail/SMS da conta GoHighLevel para escolher no
// agendamento de mensagens. Retorna vazio + connected:false quando o GHL não
// está conectado (a UI mostra a dica em vez de erro).
export async function GET(req: NextRequest) {
  const organizationId = await getCurrentOrgId();
  const type = new URL(req.url).searchParams.get("type") === "sms" ? "sms" : "email";

  if (!(await ghlConfigured(organizationId))) {
    return NextResponse.json({ connected: false, templates: [] });
  }
  try {
    const templates = await ghlListTemplates(organizationId, type);
    return NextResponse.json({ connected: true, templates });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao buscar templates";
    return NextResponse.json({ connected: true, templates: [], error: message }, { status: 200 });
  }
}
