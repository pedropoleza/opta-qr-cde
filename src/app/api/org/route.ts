import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentMembership, jsonError } from "@/lib/api";

export const dynamic = "force-dynamic";

// Dados da organização: nome, papel do usuário, membros e convites.
export async function GET() {
  const m = await getCurrentMembership();
  const [members, invites] = await Promise.all([
    prisma.membership.findMany({
      where: { organizationId: m.organization.id },
      orderBy: { createdAt: "asc" },
      select: { userId: true, email: true, role: true },
    }),
    prisma.invite.findMany({
      where: { organizationId: m.organization.id },
      orderBy: { createdAt: "asc" },
      select: { id: true, email: true, role: true },
    }),
  ]);
  return NextResponse.json({
    org: { id: m.organization.id, name: m.organization.name },
    role: m.role,
    currentUserId: m.userId,
    members,
    invites,
  });
}

// Renomeia a organização (somente owner).
export async function PATCH(req: NextRequest) {
  const m = await getCurrentMembership();
  if (m.role !== "owner") return jsonError(403, "Apenas o owner pode alterar.");
  const body = await req.json().catch(() => ({}));
  const name = String(body.name ?? "").trim();
  if (!name) return jsonError(400, "Informe o nome.");
  await prisma.organization.update({
    where: { id: m.organization.id },
    data: { name },
  });
  return NextResponse.json({ ok: true, name });
}
