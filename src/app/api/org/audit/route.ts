import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentMembership, jsonError } from "@/lib/api";

export const dynamic = "force-dynamic";

// Log de auditoria da organização (somente owner/gerente). Últimos 50 eventos.
export async function GET() {
  const m = await getCurrentMembership();
  if (m.role === "member") return jsonError(403, "Sem permissão.");
  const logs = await prisma.auditLog.findMany({
    where: { organizationId: m.organization.id },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      actorEmail: true,
      action: true,
      target: true,
      createdAt: true,
    },
  });
  return NextResponse.json({ logs });
}
