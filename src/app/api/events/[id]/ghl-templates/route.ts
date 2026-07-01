import { NextRequest, NextResponse } from "next/server";
import { getCurrentOrgId } from "@/lib/api";
import { ghlConfigured, ghlListTemplates, ghlTemplatesDebug } from "@/lib/ghl";

export const dynamic = "force-dynamic";

// Lista os templates de e-mail/SMS da conta GoHighLevel para escolher no
// agendamento de mensagens. Retorna vazio + connected:false quando o GHL não
// está conectado (a UI mostra a dica em vez de erro).
export async function GET(req: NextRequest) {
  const organizationId = await getCurrentOrgId();
  const typeParam = new URL(req.url).searchParams.get("type");

  if (!(await ghlConfigured(organizationId))) {
    return NextResponse.json({ connected: false, templates: [] });
  }

  // ?debug=1 → sonda endpoints candidatos do GHL para diagnóstico.
  if (new URL(req.url).searchParams.get("debug") === "1") {
    return NextResponse.json({ debug: await ghlTemplatesDebug(organizationId) });
  }
  try {
    // Sem type explícito → traz os dois: snippets (SMS) + templates de e-mail.
    const types: ("email" | "sms")[] =
      typeParam === "email" || typeParam === "sms" ? [typeParam] : ["email", "sms"];
    const lists = await Promise.all(
      types.map((t) => ghlListTemplates(organizationId, t).catch(() => [])),
    );
    return NextResponse.json({ connected: true, templates: lists.flat() });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao buscar templates";
    return NextResponse.json({ connected: true, templates: [], error: message }, { status: 200 });
  }
}
