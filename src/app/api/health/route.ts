import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Diagnóstico de configuração/saúde. Não expõe valores de segredos — só se a
// variável está presente no runtime e se o banco responde. Útil para
// confirmar env vars no Vercel sem precisar abrir os logs.
export async function GET() {
  const env = {
    DATABASE_URL: Boolean(process.env.DATABASE_URL),
    DIRECT_URL: Boolean(process.env.DIRECT_URL),
    JWT_SIGNING_KEY: Boolean(process.env.JWT_SIGNING_KEY),
    TICKET_TOKEN_SECRET: Boolean(process.env.TICKET_TOKEN_SECRET),
    APP_BASE_URL: Boolean(process.env.APP_BASE_URL),
    GHL_LOCATION_ID: Boolean(process.env.GHL_LOCATION_ID),
    GHL_LOCATION_TOKEN: Boolean(process.env.GHL_LOCATION_TOKEN),
  };

  let db: { ok: boolean; error?: string } = { ok: false };
  try {
    await prisma.$queryRaw`SELECT 1`;
    db = { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message.split("\n").pop() : "erro";
    db = { ok: false, error: (message ?? "erro").trim() };
  }

  const ok = Object.values(env).every(Boolean) && db.ok;
  return NextResponse.json({ ok, env, db }, { status: ok ? 200 : 503 });
}
