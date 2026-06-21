import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentMembership, jsonError } from "@/lib/api";

export const dynamic = "force-dynamic";

// Revoga um convite (somente owner).
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const m = await getCurrentMembership();
  if (m.role !== "owner") return jsonError(403, "Apenas o owner pode revogar.");
  const { id } = await params;
  await prisma.invite.deleteMany({
    where: { id, organizationId: m.organization.id },
  });
  return NextResponse.json({ ok: true });
}
