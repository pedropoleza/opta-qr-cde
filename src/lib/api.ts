import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export function jsonError(status: number, error: string) {
  return NextResponse.json({ error }, { status });
}

// Sem login próprio (app embutido como iframe no CRM): resolve a organização
// padrão do tenant. O schema mantém organization_id para multi-tenant futuro —
// quando o CRM passar a location/tenant (URL ou SSO), basta resolver aqui por
// esse contexto. Por ora, opera sobre uma única organização.
export async function getCurrentOrg() {
  const existing = await prisma.organization.findFirst({
    orderBy: { createdAt: "asc" },
  });
  if (existing) return existing;
  return prisma.organization.create({ data: { name: "SparkLeads" } });
}

export async function getCurrentOrgId(): Promise<string> {
  return (await getCurrentOrg()).id;
}

// Escopo da query por organização (mantém o isolamento do schema).
export async function findOrgEvent(eventId: string, organizationId: string) {
  return prisma.event.findFirst({
    where: { id: eventId, organizationId },
  });
}
