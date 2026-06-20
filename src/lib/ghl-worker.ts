import { prisma } from "@/lib/prisma";
import {
  GhlError,
  getGhlConfig,
  ghlAddNote,
  ghlAddTags,
  ghlUpdateContactFields,
} from "@/lib/ghl";
import { stevoConfigured, stevoSendDocument } from "@/lib/stevo";

// Worker da fila de sincronização GHL (Etapa 4 / D7). Consome
// checkin_ghl_sync_jobs e aplica tags, notas e custom fields no contato, com
// retry e backoff exponencial. Idempotente o suficiente para rodar por cron.

// D7: backoff por tentativa (em minutos). Após esgotar, o job vira "failed".
const BACKOFF_MINUTES = [1, 5, 15, 60, 360];

export type ProcessResult = {
  skipped?: boolean;
  reason?: string;
  claimed: number;
  done: number;
  failed: number;
  retried: number;
};

export async function processSyncJobs(limit = 25): Promise<ProcessResult> {
  const empty: ProcessResult = { claimed: 0, done: 0, failed: 0, retried: 0 };

  if (!getGhlConfig().configured && !stevoConfigured()) {
    return { ...empty, skipped: true, reason: "GHL/Stevo não configurados" };
  }

  // Claim atômico com FOR UPDATE SKIP LOCKED: seguro para execuções
  // concorrentes (duas invocações de cron não pegam o mesmo job).
  const claimed = await prisma.$queryRaw<Array<{ id: string }>>`
    UPDATE checkin_ghl_sync_jobs
    SET status = 'processing'
    WHERE id IN (
      SELECT id FROM checkin_ghl_sync_jobs
      WHERE status = 'pending'
        AND (next_retry_at IS NULL OR next_retry_at <= now())
      ORDER BY created_at
      LIMIT ${limit}
      FOR UPDATE SKIP LOCKED
    )
    RETURNING id;
  `;

  if (claimed.length === 0) return empty;

  const jobs = await prisma.ghlSyncJob.findMany({
    where: { id: { in: claimed.map((c) => c.id) } },
  });

  let done = 0;
  let failed = 0;
  let retried = 0;

  for (const job of jobs) {
    try {
      if (job.action === "send_whatsapp") await runWhatsappJob(job);
      else await runJob(job);
      await prisma.ghlSyncJob.update({
        where: { id: job.id },
        data: { status: "done", processedAt: new Date(), lastError: null },
      });
      done++;
    } catch (err) {
      const attempts = job.attempts + 1;
      const message = err instanceof Error ? err.message : "Erro desconhecido";

      if (attempts > BACKOFF_MINUTES.length) {
        // Esgotou as tentativas → terminal.
        await prisma.ghlSyncJob.update({
          where: { id: job.id },
          data: {
            status: "failed",
            attempts,
            lastError: message,
            processedAt: new Date(),
          },
        });
        failed++;
      } else {
        const delayMin = BACKOFF_MINUTES[attempts - 1];
        await prisma.ghlSyncJob.update({
          where: { id: job.id },
          data: {
            status: "pending",
            attempts,
            lastError: message,
            nextRetryAt: new Date(Date.now() + delayMin * 60_000),
          },
        });
        retried++;
      }
    }
  }

  return { claimed: jobs.length, done, failed, retried };
}

type SyncJob = {
  action: string;
  ghlContactId: string | null;
  guestId: string | null;
  payload: unknown;
};

async function runJob(job: SyncJob) {
  if (!job.ghlContactId) throw new GhlError("Job sem ghlContactId");
  const payload = (job.payload ?? {}) as Record<string, unknown>;

  switch (job.action) {
    case "add_tag": {
      const tag = String(payload.tag ?? "");
      if (!tag) throw new GhlError("Tag vazia no payload");
      await ghlAddTags(job.ghlContactId, [tag]);
      // #3: ao aplicar a tag-gatilho do convite, marca o e-mail como entregue
      // ao Spark (o disparo em si é do workflow do GHL).
      if (tag.startsWith("qrcode-enviado-") && job.guestId) {
        await prisma.emailLog.updateMany({
          where: { guestId: job.guestId, provider: "ghl", status: "queued" },
          data: { status: "sent", sentAt: new Date() },
        });
      }
      return;
    }
    case "add_note": {
      const note = String(payload.note ?? "");
      if (!note) throw new GhlError("Nota vazia no payload");
      await ghlAddNote(job.ghlContactId, note);
      return;
    }
    case "update_fields": {
      await ghlUpdateContactFields(job.ghlContactId, payload);
      return;
    }
    default:
      throw new GhlError(`Ação desconhecida: ${job.action}`);
  }
}

// Envio do ingresso (PDF) por WhatsApp via Stevo. Não usa ghlContactId — o
// destino é o telefone gravado no payload.
async function runWhatsappJob(job: SyncJob) {
  const payload = (job.payload ?? {}) as Record<string, unknown>;
  const to = String(payload.to ?? "");
  const url = String(payload.url ?? "");
  if (!to || !url) throw new GhlError("WhatsApp sem número ou URL no payload");

  await stevoSendDocument({
    to,
    url,
    filename: String(payload.filename ?? "ingresso.pdf"),
    caption: payload.caption ? String(payload.caption) : undefined,
  });

  if (job.guestId) {
    await prisma.emailLog.updateMany({
      where: {
        guestId: job.guestId,
        provider: "stevo-whatsapp",
        status: "queued",
      },
      data: { status: "sent", sentAt: new Date() },
    });
  }
}
