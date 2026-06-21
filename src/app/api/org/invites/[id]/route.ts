import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentMembership, jsonError } from "@/lib/api";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";

// Revoga um convite (somente owner).
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const m = await getCurrentMembership();
  if (m.role !== "owner") return jsonError(403, "Apenas o owner pode revogar.");
  const { id } = await params;
  const invite = await prisma.invite.findFirst({
    where: { id, organizationId: m.organization.id },
    select: { email: true },
  });
  await prisma.invite.deleteMany({
    where: { id, organizationId: m.organization.id },
  });
  await audit(m, "invite.revoke", invite?.email ?? id);
  return NextResponse.json({ ok: true });
}
