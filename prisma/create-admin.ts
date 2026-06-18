import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

// Cria/atualiza um usuário organizador. Credenciais vêm de variáveis de
// ambiente (nunca commitadas):
//   ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME (opcional), ADMIN_ORG (opcional)
// Uso: ADMIN_EMAIL=... ADMIN_PASSWORD=... npx tsx prisma/create-admin.ts
const prisma = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_EMAIL?.toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    throw new Error("Defina ADMIN_EMAIL e ADMIN_PASSWORD no ambiente.");
  }
  const orgName = process.env.ADMIN_ORG ?? "SparkLeads";

  const org =
    (await prisma.organization.findFirst({ where: { name: orgName } })) ??
    (await prisma.organization.create({ data: { name: orgName } }));

  const user = await prisma.user.upsert({
    where: { email },
    update: { passwordHash: await bcrypt.hash(password, 10), organizationId: org.id },
    create: {
      email,
      name: process.env.ADMIN_NAME ?? email.split("@")[0],
      passwordHash: await bcrypt.hash(password, 10),
      role: "organizer",
      organizationId: org.id,
    },
  });
  console.log(`OK: ${user.email} (org "${org.name}")`);
}

main().finally(() => prisma.$disconnect());
