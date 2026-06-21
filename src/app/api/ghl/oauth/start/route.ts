import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCurrentOrgId, jsonError } from "@/lib/api";
import { ghlAuthorizeUrl, ghlOAuthConfigured } from "@/lib/ghl-oauth";

export const dynamic = "force-dynamic";

// Inicia o OAuth do Marketplace: guarda um state (CSRF) e redireciona para o GHL.
export async function GET(_req: NextRequest) {
  if (!ghlOAuthConfigured()) {
    return jsonError(400, "OAuth do GHL não configurado (defina GHL_CLIENT_ID/SECRET).");
  }
  await getCurrentOrgId(); // exige sessão do organizador

  const state = crypto.randomBytes(16).toString("hex");
  const store = await cookies();
  store.set("ghl_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 600,
  });
  return NextResponse.redirect(ghlAuthorizeUrl(state));
}
