import { NextResponse } from "next/server";
import { getOrganizerSession, OrganizerSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export function jsonError(status: number, error: string) {
  return NextResponse.json({ error }, { status });
}

export async function requireOrganizer(): Promise<OrganizerSession | NextResponse> {
  const session = await getOrganizerSession();
  if (!session) return jsonError(401, "Não autenticado");
  return session;
}

// Escopo multi-tenant (D6): toda query de evento valida organization_id.
export async function findOrgEvent(eventId: string, organizationId: string) {
  return prisma.event.findFirst({
    where: { id: eventId, organizationId },
  });
}
