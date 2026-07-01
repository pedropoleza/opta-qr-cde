import { NextRequest, NextResponse } from "next/server";
import { getCurrentOrgId } from "@/lib/api";
import { ghlConfigured, ghlListTemplates } from "@/lib/ghl";

export const dynamic = "force-dynamic";

// Templates da conta GHL a nível de organização (sem depender de um evento) —
// usado no editor de mensagens durante a criação do evento.
// ?type=email → templates de e-mail (Email Builder); ?type=sms → snippets;
// sem type → ambos.
export async function GET(req: NextRequest) {
  const organizationId = await getCurrentOrgId();
  const typeParam = new URL(req.url).searchParams.get("type");
  if (!(await ghlConfigured(organizationId))) {
    return NextResponse.json({ connected: false, templates: [] });
  }
  const types: ("email" | "sms")[] =
    typeParam === "email" || typeParam === "sms" ? [typeParam] : ["email", "sms"];
  const lists = await Promise.all(
    types.map((t) => ghlListTemplates(organizationId, t).catch(() => [])),
  );
  return NextResponse.json({ connected: true, templates: lists.flat() });
}
