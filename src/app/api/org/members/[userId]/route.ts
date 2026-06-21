import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentMembership, jsonError } from "@/lib/api";

export const dynamic = "force-dynamic";

// Altera papel de um membro (somente owner).
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  const m = await getCurrentMembership();
  if (m.role !== "owner") return jsonError(403, "Apenas o owner gerencia papéis.");
  const { userId } = await params;
  const body = await req.json().catch(() => ({}));
  const role = ["owner", "manager", "member"].includes(body.role)
    ? body.role
    : null;
  if (!role) return jsonError(400, "Papel inválido.");

  const target = await prisma.membership.findFirst({
    where: { userId, organizationId: m.organization.id },
  });
  if (!target) return jsonError(404, "Membro não encontrado.");

  // Não permite remover o último owner.
  if (target.role === "owner" && role !== "owner") {
    const owners = await prisma.membership.count({
      where: { organizationId: m.organization.id, role: "owner" },
    });
    if (owners <= 1) return jsonError(400, "A organização precisa de ao menos um owner.");
  }
  await prisma.membership.updateMany({
    where: { userId, organizationId: m.organization.id },
    data: { role },
  });
  return NextResponse.json({ ok: true });
}

// Remove um membro (somente owner; não remove o último owner nem a si mesmo).
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  const m = await getCurrentMembership();
  if (m.role !== "owner") return jsonError(403, "Apenas o owner remove membros.");
  const { userId } = await params;
  if (userId === m.userId) return jsonError(400, "Você não pode se remover.");

  const target = await prisma.membership.findFirst({
    where: { userId, organizationId: m.organization.id },
  });
  if (!target) return jsonError(404, "Membro não encontrado.");
  if (target.role === "owner") {
    const owners = await prisma.membership.count({
      where: { organizationId: m.organization.id, role: "owner" },
    });
    if (owners <= 1) return jsonError(400, "A organização precisa de ao menos um owner.");
  }
  await prisma.membership.deleteMany({
    where: { userId, organizationId: m.organization.id },
  });
  return NextResponse.json({ ok: true });
}
