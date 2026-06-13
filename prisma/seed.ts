import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

// Seed inicial: organização SparkLeads + usuário organizador.
// Em produção, defina SEED_ADMIN_EMAIL/SEED_ADMIN_PASSWORD antes de rodar.
const prisma = new PrismaClient();

async function main() {
  const email = (process.env.SEED_ADMIN_EMAIL ?? "info@sparkleads.pro").toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD ?? "spark-checkin-2026";

  const org =
    (await prisma.organization.findFirst({ where: { name: "SparkLeads" } })) ??
    (await prisma.organization.create({ data: { name: "SparkLeads" } }));

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`Usuário ${email} já existe — nada a fazer.`);
    return;
  }

  await prisma.user.create({
    data: {
      organizationId: org.id,
      name: "SparkLeads Admin",
      email,
      passwordHash: await bcrypt.hash(password, 10),
      role: "organizer",
    },
  });
  console.log(`Organização "${org.name}" e usuário ${email} criados.`);
  if (!process.env.SEED_ADMIN_PASSWORD) {
    console.log(`Senha padrão de desenvolvimento: ${password} — troque em produção.`);
  }
}

main().finally(() => prisma.$disconnect());
