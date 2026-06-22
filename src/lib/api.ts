import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authEnabled } from "@/lib/supabase/config";
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
  // Login desativado → single-tenant: resolve a organização única (Opta).
  if (!authEnabled()) {
    const existing = await prisma.organization.findFirst({
      orderBy: { createdAt: "asc" },
    });
    if (existing) return existing;
    return prisma.organization.create({ data: { name: "Opta Finance" } });
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

  const email = user.email ?? null;

  // 1) Convite pendente para este e-mail → entra na organização do convite.
  if (email) {
    const invite = await prisma.invite.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
    });
    if (invite) {
      const org = await prisma.organization.findUnique({
        where: { id: invite.organizationId },
      });
      if (org) {
        await prisma.$transaction([
          prisma.membership.create({
            data: {
              userId: user.id,
              organizationId: org.id,
              email,
              role: invite.role,
            },
          }),
          prisma.invite.delete({ where: { id: invite.id } }),
        ]);
        return org;
      }
    }
  }

  // 2) Primeiro usuário do sistema herda a organização existente (preserva Opta).
  const totalMemberships = await prisma.membership.count();
  let org;
  if (totalMemberships === 0) {
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
    data: { userId: user.id, organizationId: org.id, email, role: "owner" },
  });
  return org;
}

// Membership da sessão (organização + papel). Em modo single-tenant (sem
// Supabase) devolve a org padrão com papel "owner".
export async function getCurrentMembership() {
  if (!authEnabled()) {
    const org = await getCurrentOrg();
    return { organization: org, role: "owner" as const, userId: null, email: null };
  }
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("UNAUTHENTICATED");
  // Garante provisão/convite resolvido.
  const org = await getCurrentOrg();
  const membership = await prisma.membership.findUnique({
    where: { userId: user.id },
  });
  return {
    organization: org,
    role: (membership?.role ?? "owner") as "owner" | "manager" | "member",
    userId: user.id,
    email: user.email ?? null,
  };
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
