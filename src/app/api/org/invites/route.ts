import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentMembership, jsonError } from "@/lib/api";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";

// Convida alguém por e-mail (somente owner). O convite é consumido quando a
// pessoa fizer login com esse e-mail (entra na organização com o papel).
export async function POST(req: NextRequest) {
  const m = await getCurrentMembership();
  if (m.role !== "owner") return jsonError(403, "Apenas o owner convida.");

  const body = await req.json().catch(() => ({}));
  const email = String(body.email ?? "").trim().toLowerCase();
  const role = ["manager", "member"].includes(body.role) ? body.role : "member";
  if (!email || !email.includes("@")) return jsonError(400, "E-mail inválido.");

  const existing = await prisma.membership.findFirst({
    where: { organizationId: m.organization.id, email: { equals: email, mode: "insensitive" } },
  });
  if (existing) return jsonError(400, "Essa pessoa já está na equipe.");

  const invite = await prisma.invite.upsert({
    where: { organizationId_email: { organizationId: m.organization.id, email } },
    create: { organizationId: m.organization.id, email, role },
    update: { role },
  });
  await audit(m, "invite.create", email, { role });
  return NextResponse.json({ invite });
}
