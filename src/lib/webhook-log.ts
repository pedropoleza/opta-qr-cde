import { prisma } from "@/lib/prisma";

// Registra (best-effort) toda requisição recebida em webhooks, com o motivo do
// desfecho. Nunca lança — observabilidade não pode derrubar o webhook.
export async function logWebhook(
  provider: string,
  token: string | null,
  outcome: string,
  opts?: { eventType?: string | null; detail?: string | null },
): Promise<void> {
  try {
    await prisma.webhookLog.create({
      data: {
        provider,
        token: token ?? null,
        outcome,
        eventType: opts?.eventType ?? null,
        detail: opts?.detail ?? null,
      },
    });
  } catch {
    /* best-effort */
  }
}
