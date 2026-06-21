import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentMembership, jsonError } from "@/lib/api";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";

// Normaliza cor hex (#rgb ou #rrggbb); devolve null se inválida.
function normalizeHex(value: unknown): string | null {
  const v = String(value ?? "").trim();
  if (!v) return null;
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(v) ? v : null;
}

// Dados da organização: nome, branding, papel do usuário, membros e convites.
export async function GET() {
  const m = await getCurrentMembership();
  const [org, members, invites] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: m.organization.id },
      select: { id: true, name: true, brandName: true, logoUrl: true, primaryColor: true },
    }),
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
    org: org ?? { id: m.organization.id, name: m.organization.name },
    role: m.role,
    currentUserId: m.userId,
    members,
    invites,
  });
}

// Atualiza nome e branding da organização (somente owner).
export async function PATCH(req: NextRequest) {
  const m = await getCurrentMembership();
  if (m.role !== "owner") return jsonError(403, "Apenas o owner pode alterar.");
  const body = await req.json().catch(() => ({}));

  const data: {
    name?: string;
    brandName?: string | null;
    logoUrl?: string | null;
    primaryColor?: string | null;
  } = {};

  if (body.name !== undefined) {
    const name = String(body.name ?? "").trim();
    if (!name) return jsonError(400, "Informe o nome.");
    data.name = name;
  }
  if (body.brandName !== undefined)
    data.brandName = String(body.brandName ?? "").trim() || null;
  if (body.logoUrl !== undefined)
    data.logoUrl = String(body.logoUrl ?? "").trim() || null;
  if (body.primaryColor !== undefined)
    data.primaryColor = normalizeHex(body.primaryColor);

  if (Object.keys(data).length === 0) return jsonError(400, "Nada para atualizar.");

  await prisma.organization.update({ where: { id: m.organization.id }, data });
  await audit(m, "org.update", m.organization.id, data);
  return NextResponse.json({ ok: true });
}
