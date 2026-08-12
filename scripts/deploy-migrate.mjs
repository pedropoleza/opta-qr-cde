// Aplica as migrations no deploy (Vercel) ANTES do build, para o app nunca
// subir esperando colunas que ainda não existem no banco.
//
// Estratégia:
//   1) `prisma migrate deploy` — caminho normal (idempotente).
//   2) Se o banco tem schema mas NÃO tem histórico de migrations (erro P3005 —
//      bancos criados por `db push`), faz o BASELINE: marca as migrations já
//      refletidas no schema como aplicadas (migrate resolve --applied) e deixa
//      só a(s) nova(s) rodar. Depois disso o banco passa a ter histórico e os
//      próximos deploys usam `migrate deploy` normal — sem --accept-data-loss.
//   - Qualquer outra falha bloqueia o build (melhor barrar o deploy do que
//     publicar código incompatível com o schema).
//   - Sem banco configurado (build local), apenas pula.
import { execSync } from "node:child_process";
import { readdirSync } from "node:fs";

function sh(cmd) {
  return execSync(cmd, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

const hasDb = Boolean(
  (process.env.DIRECT_URL && process.env.DIRECT_URL.trim()) ||
    (process.env.DATABASE_URL && process.env.DATABASE_URL.trim()),
);

if (!hasDb) {
  console.log("[deploy-migrate] sem DATABASE_URL/DIRECT_URL — pulando.");
  process.exit(0);
}

function migrateDeploy() {
  return sh("npx --no-install prisma migrate deploy");
}

console.log("[deploy-migrate] aplicando migrations (prisma migrate deploy)…");
try {
  console.log(migrateDeploy());
  console.log("[deploy-migrate] ok (migrate deploy).");
  process.exit(0);
} catch (err) {
  const out = `${err.stdout ?? ""}${err.stderr ?? ""}`;
  console.log(out);

  if (!out.includes("P3005")) {
    console.error("[deploy-migrate] FALHOU (migrate deploy) — bloqueando o build.");
    process.exit(1);
  }

  // Banco existente sem histórico (db push). Baseline único.
  try {
    const migrations = readdirSync("prisma/migrations", { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .sort();
    // As migrations já estão refletidas no schema, exceto a(s) mais nova(s)
    // deste deploy. Marca todas menos a última como aplicadas; a última roda.
    const baseline = migrations.slice(0, -1);
    console.log(
      `[deploy-migrate] P3005 → baseline: marcando ${baseline.length} migrations como aplicadas…`,
    );
    for (const name of baseline) {
      try {
        sh(`npx --no-install prisma migrate resolve --applied ${name}`);
      } catch {
        // Benigno: já registrada (ex.: tentativa de deploy anterior parcial).
        console.log(`[deploy-migrate] resolve ${name}: já aplicada — ignorando.`);
      }
    }
    console.log("[deploy-migrate] baseline pronto — aplicando a migration nova…");
    console.log(migrateDeploy());
    console.log("[deploy-migrate] ok (baseline + migrate deploy).");
    process.exit(0);
  } catch (err2) {
    console.error(`${err2.stdout ?? ""}${err2.stderr ?? ""}`);
    console.error("[deploy-migrate] FALHOU no baseline — bloqueando o build.");
    process.exit(1);
  }
}
