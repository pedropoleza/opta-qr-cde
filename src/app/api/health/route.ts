import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Diagnóstico de configuração/saúde. Não expõe valores de segredos — só se a
// variável está presente no runtime e se o banco responde. Útil para
// confirmar a prontidão de produção sem abrir os logs.
export async function GET() {
  const has = (v?: string | null) => Boolean(v && v.trim());

  // Obrigatórios para a aplicação subir e operar.
  const required = {
    DATABASE_URL: has(process.env.DATABASE_URL),
    DIRECT_URL: has(process.env.DIRECT_URL),
    JWT_SIGNING_KEY: has(process.env.JWT_SIGNING_KEY),
    TICKET_TOKEN_SECRET: has(process.env.TICKET_TOKEN_SECRET),
    APP_BASE_URL: has(process.env.APP_BASE_URL),
  };

  // Opcionais: habilitam canais/recursos extras (não bloqueiam o boot).
  const optional = {
    CRON_SECRET: has(process.env.CRON_SECRET),
    RESEND_API_KEY: has(process.env.RESEND_API_KEY),
    EMAIL_FROM: has(process.env.EMAIL_FROM),
    STEVO_API_URL: has(process.env.STEVO_API_URL),
    STEVO_API_KEY: has(process.env.STEVO_API_KEY),
    GHL_LOCATION_ID: has(process.env.GHL_LOCATION_ID),
    GHL_LOCATION_TOKEN: has(process.env.GHL_LOCATION_TOKEN),
    GHL_CLIENT_ID: has(process.env.GHL_CLIENT_ID),
    GHL_CLIENT_SECRET: has(process.env.GHL_CLIENT_SECRET),
  };

  const ghlConnections = await prisma.ghlConnection.count().catch(() => 0);
  const channels = {
    email_resend: optional.RESEND_API_KEY && optional.EMAIL_FROM,
    whatsapp_stevo: optional.STEVO_API_URL && optional.STEVO_API_KEY,
    ghl_connected:
      ghlConnections > 0 || (optional.GHL_LOCATION_ID && optional.GHL_LOCATION_TOKEN),
    ghl_oauth: optional.GHL_CLIENT_ID && optional.GHL_CLIENT_SECRET,
  };

  let db: { ok: boolean; error?: string } = { ok: false };
  try {
    await prisma.$queryRaw`SELECT 1`;
    db = { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message.split("\n").pop() : "erro";
    db = { ok: false, error: (message ?? "erro").trim() };
  }

  // Pronto para entregar o ingresso por ALGUM canal?
  const ready_to_deliver =
    channels.email_resend || channels.whatsapp_stevo || channels.ghl_connected;

  const ok = Object.values(required).every(Boolean) && db.ok;
  return NextResponse.json(
    { ok, ready_to_deliver, required, optional, channels, db },
    { status: ok ? 200 : 503 },
  );
}
