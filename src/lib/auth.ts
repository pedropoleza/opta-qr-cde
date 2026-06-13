import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

// Sessões JWT (seção 3.4): organizador/manager com escopo por organization_id
// e sessão do Checker (D4) com escopo por evento — sem acesso a dados sensíveis.

const SESSION_COOKIE = "spark_session";
const CHECKER_COOKIE = "spark_checker";

export type OrganizerSession = {
  userId: string;
  organizationId: string;
  role: string;
  name: string;
};

export type CheckerSession = {
  eventId: string;
  role: "checker";
};

function signingKey(): Uint8Array {
  const key = process.env.JWT_SIGNING_KEY;
  if (!key) throw new Error("JWT_SIGNING_KEY não configurado");
  return new TextEncoder().encode(key);
}

export async function createOrganizerSession(session: OrganizerSession) {
  const jwt = await new SignJWT(session)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(signingKey());
  const store = await cookies();
  store.set(SESSION_COOKIE, jwt, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function getOrganizerSession(): Promise<OrganizerSession | null> {
  const store = await cookies();
  const jwt = store.get(SESSION_COOKIE)?.value;
  if (!jwt) return null;
  try {
    const { payload } = await jwtVerify(jwt, signingKey());
    return payload as unknown as OrganizerSession;
  } catch {
    return null;
  }
}

export async function destroyOrganizerSession() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
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
