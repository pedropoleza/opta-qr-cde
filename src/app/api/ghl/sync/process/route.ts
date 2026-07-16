import { NextRequest, NextResponse } from "next/server";
import { processSyncJobs } from "@/lib/ghl-worker";
import { processReminders } from "@/lib/reminders";
import { syncAllTaggedEvents } from "@/lib/lead-sync";
import {
  reconcileSquarePayments,
  processPaymentReminders,
} from "@/lib/square-payments";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Limpa baldes de rate limit já expirados (>1h) para manter a tabela enxuta.
async function pruneRateLimits(): Promise<number> {
  try {
    return await prisma.$executeRaw`
      DELETE FROM checkin_rate_limits WHERE window_start < now() - interval '1 hour';
    `;
  } catch {
    return 0;
  }
}

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
  // Lembretes antes da fila: pode enfileirar novos jobs para esta rodada.
  const reminders = await processReminders().catch(() => ({ rulesFired: 0, queued: 0 }));
  // Entrada automática de leads por tag (eventos ativos, throttle por evento).
  const leads = await syncAllTaggedEvents().catch(() => ({ events: 0, created: 0, updated: 0 }));
  // Pagamentos Square: concilia recentes + dispara lembretes de 30 min.
  const squareRecon = await reconcileSquarePayments().catch(() => ({ checked: 0, paid: 0 }));
  const payReminders = await processPaymentReminders().catch(() => ({ sent: 0 }));
  const [result, pruned] = await Promise.all([
    processSyncJobs(),
    pruneRateLimits(),
  ]);
  return NextResponse.json({
    ...result,
    reminders,
    leads,
    squareRecon,
    payReminders,
    rateLimitsPruned: pruned,
  });
}

export async function GET(req: NextRequest) {
  return handle(req);
}

export async function POST(req: NextRequest) {
  return handle(req);
}
