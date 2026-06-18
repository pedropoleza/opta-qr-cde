import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

// Sessão do Checker (D4): escopo por evento, autenticada por link + PIN, sem
// acesso a dados sensíveis. O painel do organizador NÃO tem login próprio —
// o Spark Check-in roda embutido como iframe no CRM, que já autentica o
// usuário; o escopo de organização é resolvido em lib/api.ts.

const CHECKER_COOKIE = "spark_checker";

export type CheckerSession = {
  eventId: string;
  role: "checker";
};

function signingKey(): Uint8Array {
  const key = process.env.JWT_SIGNING_KEY;
  if (!key) throw new Error("JWT_SIGNING_KEY não configurado");
  return new TextEncoder().encode(key);
}

export async function createCheckerSession(eventId: string) {
  const jwt = await new SignJWT({ eventId, role: "checker" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("24h")
    .sign(signingKey());
  const store = await cookies();
  store.set(CHECKER_COOKIE, jwt, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24,
  });
}

export async function getCheckerSession(): Promise<CheckerSession | null> {
  const store = await cookies();
  const jwt = store.get(CHECKER_COOKIE)?.value;
  if (!jwt) return null;
  try {
    const { payload } = await jwtVerify(jwt, signingKey());
    if (payload.role !== "checker") return null;
    return payload as unknown as CheckerSession;
  } catch {
    return null;
  }
}
