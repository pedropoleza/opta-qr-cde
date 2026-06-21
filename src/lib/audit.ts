import { prisma } from "@/lib/prisma";

// Auditoria de ações sensíveis (Fase 5). "Falha aberto": registrar a auditoria
// nunca pode derrubar a ação principal, então engolimos erros aqui.
export type AuditActor = {
  organization: { id: string };
  userId?: string | null;
  email?: string | null;
};

export async function audit(
  actor: AuditActor,
  action: string,
  target?: string | null,
  metadata?: Record<string, unknown>,
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        organizationId: actor.organization.id,
        actorId: actor.userId ?? null,
        actorEmail: actor.email ?? null,
        action,
        target: target ?? null,
        metadata: metadata ? (metadata as object) : undefined,
      },
    });
  } catch {
    // silencioso — auditoria é best-effort
  }
}
