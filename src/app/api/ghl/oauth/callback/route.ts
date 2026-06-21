import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCurrentOrgId, getCurrentMembership } from "@/lib/api";
import { exchangeCode } from "@/lib/ghl-oauth";
import { saveOauthConnection } from "@/lib/ghl";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";

// Callback do OAuth: valida o state, troca o code por tokens e grava a conexão.
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const store = await cookies();
  const expected = store.get("ghl_oauth_state")?.value;
  store.delete("ghl_oauth_state");

  const back = (params: string) =>
    NextResponse.redirect(new URL(`/connection${params}`, req.url));

  if (!code || !state || !expected || state !== expected) {
    return back("?error=oauth");
  }

  try {
    const organizationId = await getCurrentOrgId();
    const token = await exchangeCode(code);
    await saveOauthConnection(organizationId, token);
    try {
      const m = await getCurrentMembership();
      await audit(m, "ghl.connect", token.locationId ?? "oauth");
    } catch {
      /* auditoria é best-effort */
    }
    return back("?connected=1");
  } catch {
    return back("?error=oauth");
  }
}
