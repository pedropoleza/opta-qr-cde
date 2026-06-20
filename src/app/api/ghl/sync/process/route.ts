import { NextRequest, NextResponse } from "next/server";
import { processSyncJobs } from "@/lib/ghl-worker";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Worker da fila GHL — chamado pelo Vercel Cron (GET) e disponível para
// disparo manual. Protegido por CRON_SECRET quando definido.
function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return true; // sem segredo configurado → liberado
  if (req.headers.get("authorization") === `Bearer ${secret}`) return true;
  return new URL(req.url).searchParams.get("secret") === secret;
}

async function handle(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  const result = await processSyncJobs();
  return NextResponse.json(result);
}

export async function GET(req: NextRequest) {
  return handle(req);
}

export async function POST(req: NextRequest) {
  return handle(req);
}
