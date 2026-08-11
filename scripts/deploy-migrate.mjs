// Aplica migrations pendentes no deploy (Vercel) ANTES do build, para o app
// nunca subir esperando colunas que ainda não existem no banco.
//
// - Roda `prisma migrate deploy` (idempotente: só aplica o que falta).
// - Usa DIRECT_URL (conexão direta) quando houver; senão cai no DATABASE_URL.
// - Se falhar, o build FALHA de propósito — melhor bloquear o deploy do que
//   publicar código incompatível com o schema em produção.
// - Sem banco configurado (ex.: build local sem env), apenas avisa e segue.
import { execSync } from "node:child_process";

const hasDb = Boolean(
  (process.env.DIRECT_URL && process.env.DIRECT_URL.trim()) ||
    (process.env.DATABASE_URL && process.env.DATABASE_URL.trim()),
);

if (!hasDb) {
  console.log("[deploy-migrate] sem DATABASE_URL/DIRECT_URL — pulando migrate.");
  process.exit(0);
}

try {
  console.log("[deploy-migrate] aplicando migrations pendentes (prisma migrate deploy)…");
  // --no-install: usa o prisma já instalado (não busca na rede) e resolve o
  // binário mesmo fora do contexto de `npm run` (onde node_modules/.bin não
  // está no PATH).
  execSync("npx --no-install prisma migrate deploy", { stdio: "inherit" });
  console.log("[deploy-migrate] ok.");
} catch (err) {
  console.error("[deploy-migrate] FALHOU — bloqueando o build para não quebrar produção.");
  console.error(err?.message ?? err);
  process.exit(1);
}
