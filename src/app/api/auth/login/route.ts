import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { createOrganizerSession } from "@/lib/auth";
import { jsonError } from "@/lib/api";

export async function POST(req: NextRequest) {
  const { email, password } = await req.json();
  if (!email || !password) return jsonError(400, "Informe e-mail e senha");

  const user = await prisma.user.findUnique({ where: { email: String(email).toLowerCase() } });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return jsonError(401, "Credenciais inválidas");
  }

  await createOrganizerSession({
    userId: user.id,
    organizationId: user.organizationId,
    role: user.role,
    name: user.name,
  });
  return NextResponse.json({ ok: true, name: user.name });
}
