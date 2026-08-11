import { SignJWT, jwtVerify } from "jose";

// Trava de acesso ao PAINEL do organizador (grupo de rotas `(app)` + APIs de
// gestão/escrita). O app roda embutido como iframe no CRM (GHL); a trava
// distingue "acesso legítimo pelo CRM" de "acesso externo direto na URL".
//
// Mecânica (escolha do Time): o menu/iframe do GHL abre a URL do app com um
// segredo (`?k=<ADMIN_EMBED_SECRET>`). O proxy valida, grava um cookie assinado
// (não guarda o segredo cru) e passa a exigi-lo nas rotas de painel. Sem cookie
// válido → o visitante é mandado para fora (nunca vê o painel).
//
// Rollout seguro: a trava só LIGA quando `ADMIN_EMBED_SECRET` está definido.
// Sem o segredo, o painel segue aberto (comportamento atual) — assim o deploy
// não tranca o acesso antes de configurar o segredo no GHL/Vercel.

export const EMBED_COOKIE = "opta_embed";

function signingKey(): Uint8Array {
  const key = process.env.JWT_SIGNING_KEY;
  if (!key) throw new Error("JWT_SIGNING_KEY não configurado");
  return new TextEncoder().encode(key);
}

export function embedSecret(): string {
  return (process.env.ADMIN_EMBED_SECRET ?? "").trim();
}

// Trava ativa somente com segredo configurado (ver nota de rollout acima).
export function embedGateEnabled(): boolean {
  return embedSecret().length > 0;
}

// Emite o token de sessão de embed (assinado com JWT_SIGNING_KEY, 30 dias).
export async function issueEmbedToken(): Promise<string> {
  return new SignJWT({ scope: "admin" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(signingKey());
}

export async function verifyEmbedToken(
  token: string | undefined | null,
): Promise<boolean> {
  if (!token) return false;
  try {
    const { payload } = await jwtVerify(token, signingKey());
    return payload.scope === "admin";
  } catch {
    return false;
  }
}

// Destino para quem chega de fora (sem cookie de embed) numa rota de painel, ou
// quando o `/pay` não consegue montar o checkout. NUNCA é o painel.
// Preferência: destino público explícito → checkout geral do Square → site.
export function publicRedirectUrl(): string {
  return (
    (process.env.PUBLIC_REDIRECT_URL ?? "").trim() ||
    (process.env.SQUARE_GENERAL_CHECKOUT_URL ?? "").trim() ||
    "https://optafinance.com"
  );
}

// Classificação de rotas. Padrão default-deny: só o que está explicitamente
// listado como PÚBLICO passa sem trava; o resto (páginas do painel + APIs de
// gestão) exige embed. Assim, rota nova nasce protegida por padrão.
const PUBLIC_PREFIXES = [
  "/q/", // página pública do QR do convidado
  "/nps/", // pesquisa NPS pós-evento
  "/checker/", // modo checker (link + PIN, escopo por evento)
  "/kiosk/", // totem de auto check-in
  "/checkin/", // página de validação do scan
  "/api/hooks/", // webhooks de entrada (registration/lead/square)
  "/api/q/",
  "/api/nps/",
  "/api/checker/",
  "/api/kiosk/",
  "/api/checkin/",
  "/api/qr/", // PNG do QR por token
  "/api/ticket/", // PDF/certificado/badge públicos por token
  "/api/checkout/", // config + cobrança da modal de pagamento (público)
  "/api/ghl/oauth/", // ida/volta do OAuth do GHL (redirect do marketplace)
  "/api/ghl/sync/", // cron do Vercel (protegido por CRON_SECRET no handler)
];

const PUBLIC_EXACT = new Set<string>([
  "/pay", // redirect inteligente de pagamento (checkout Square)
  "/checkout", // modal de pagamento embutida (Web Payments SDK)
  "/api/square/webhook",
  "/api/health",
]);

// Arquivos estáticos servidos por caminho (logo, manifest, sw, ícones): passam
// sempre (têm extensão no último segmento).
function isStaticAsset(pathname: string): boolean {
  const last = pathname.slice(pathname.lastIndexOf("/") + 1);
  return last.includes(".");
}

export function isPublicPath(pathname: string): boolean {
  if (isStaticAsset(pathname)) return true;
  if (PUBLIC_EXACT.has(pathname)) return true;
  return PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));
}
