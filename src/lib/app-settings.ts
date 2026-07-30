import { prisma } from "@/lib/prisma";

// Config chave/valor persistida no banco (tabela checkin_app_settings). Serve
// para valores que a gente quer trocar "por aqui" sem redeploy (ex.: chave do
// Stevo) e para cursores duráveis de jobs (ex.: conciliação do Square).
//
// Leituras/escritas são blindadas por try/catch: se a tabela não existir ou o
// banco falhar, os chamadores caem no comportamento padrão em vez de quebrar.

export async function getAppSetting(key: string): Promise<string | null> {
  try {
    const rows = await prisma.$queryRaw<Array<{ value: string | null }>>`
      SELECT value FROM checkin_app_settings WHERE key = ${key} LIMIT 1
    `;
    const v = rows?.[0]?.value ?? null;
    return v && v.trim() ? v.trim() : null;
  } catch {
    return null;
  }
}

export async function setAppSetting(key: string, value: string): Promise<boolean> {
  try {
    await prisma.$executeRaw`
      INSERT INTO checkin_app_settings (key, value, updated_at)
      VALUES (${key}, ${value}, now())
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()
    `;
    return true;
  } catch {
    return false;
  }
}
