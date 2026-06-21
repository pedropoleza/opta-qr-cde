import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { supabaseConfigured } from "@/lib/supabase/config";
import { createSupabaseServer } from "@/lib/supabase/server";

export function jsonError(status: number, error: string) {
  return NextResponse.json({ error }, { status });
}

function orgNameFromEmail(email?: string | null): string {
  if (!email) return "Minha organização";
  const handle = email.split("@")[0];
  return `${handle.charAt(0).toUpperCase()}${handle.slice(1)} workspace`;
}

// Resolve a organização do tenant.
// - Sem Supabase Auth (env desligado): modo single-tenant (organização padrão).
// - Com Supabase Auth: resolve pela sessão (membership). Auto-provisiona no 1º
//   acesso: o primeiro usuário do sistema herda a organização existente (Opta);
//   os demais ganham uma organização nova. Multi-tenant para várias contas.
export async function getCurrentOrg() {
  if (!supabaseConfigured()) {
    const existing = await prisma.organization.findFirst({
      orderBy: { createdAt: "asc" },
    });
    if (existing) return existing;
    return prisma.organization.create({ data: { name: "SparkLeads" } });
  }

  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("UNAUTHENTICATED");

  const membership = await prisma.membership.findUnique({
    where: { userId: user.id },
    include: { organization: true },
  });
  if (membership) return membership.organization;

  const totalMemberships = await prisma.membership.count();
  let org;
  if (totalMemberships === 0) {
    // Primeiro usuário assume a organização existente (preserva dados da Opta).
    org =
      (await prisma.organization.findFirst({ orderBy: { createdAt: "asc" } })) ??
      (await prisma.organization.create({
        data: { name: orgNameFromEmail(user.email) },
      }));
  } else {
    org = await prisma.organization.create({
      data: { name: orgNameFromEmail(user.email) },
    });
  }
  await prisma.membership.create({
    data: { userId: user.id, organizationId: org.id, role: "owner" },
  });
  return org;
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
