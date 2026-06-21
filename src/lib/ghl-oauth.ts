// OAuth do Marketplace do GHL (LeadConnector). Conecta a subaccount via "install"
// → callback → troca o code por access/refresh token (escopo da location).
// Gated nas credenciais do app (env). O schema GhlConnection já guarda
// accessToken/refreshToken/expiresAt/scopes.

const MARKETPLACE_BASE = "https://marketplace.leadconnectorhq.com";
const SERVICES_BASE = "https://services.leadconnectorhq.com";

function cleanEnv(value?: string | null): string {
  return (value ?? "").trim().replace(/^["']+|["']+$/g, "").trim();
}

// Escopos necessários para: ler/escrever contatos e tags, e ENVIAR mensagens
// (e-mail/SMS/WhatsApp) direto pela API de Conversations.
export const GHL_OAUTH_SCOPES = [
  "contacts.write",
  "contacts.readonly",
  "conversations.write",
  "conversations.readonly",
  "conversations/message.write",
  "locations.readonly",
].join(" ");

export function ghlClientId(): string {
  return cleanEnv(process.env.GHL_CLIENT_ID);
}
export function ghlClientSecret(): string {
  return cleanEnv(process.env.GHL_CLIENT_SECRET);
}
export function ghlOAuthConfigured(): boolean {
  return Boolean(ghlClientId() && ghlClientSecret());
}
export function oauthRedirectUri(): string {
  const base =
    cleanEnv(process.env.APP_BASE_URL) || "https://spark-qrcode-checker.vercel.app";
  return `${base.replace(/\/$/, "")}/api/ghl/oauth/callback`;
}

export function ghlAuthorizeUrl(state: string): string {
  const params = new URLSearchParams({
    response_type: "code",
    redirect_uri: oauthRedirectUri(),
    client_id: ghlClientId(),
    scope: GHL_OAUTH_SCOPES,
    state,
  });
  return `${MARKETPLACE_BASE}/oauth/chooselocation?${params.toString()}`;
}

export type GhlTokenResponse = {
  access_token: string;
  refresh_token: string;
  expires_in: number; // segundos
  scope?: string;
  locationId?: string;
  companyId?: string;
  userType?: string;
};

async function tokenRequest(body: Record<string, string>): Promise<GhlTokenResponse> {
  const res = await fetch(`${SERVICES_BASE}/oauth/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: new URLSearchParams(body).toString(),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`GHL OAuth token → ${res.status} ${t.slice(0, 200)}`);
  }
  return (await res.json()) as GhlTokenResponse;
}

export function exchangeCode(code: string): Promise<GhlTokenResponse> {
  return tokenRequest({
    client_id: ghlClientId(),
    client_secret: ghlClientSecret(),
    grant_type: "authorization_code",
    code,
    user_type: "Location",
    redirect_uri: oauthRedirectUri(),
  });
}

export function refreshAccessToken(refreshToken: string): Promise<GhlTokenResponse> {
  return tokenRequest({
    client_id: ghlClientId(),
    client_secret: ghlClientSecret(),
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    user_type: "Location",
    redirect_uri: oauthRedirectUri(),
  });
}
