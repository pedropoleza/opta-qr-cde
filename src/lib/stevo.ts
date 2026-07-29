// Cliente do Stevo (WhatsApp API estilo wuzapi). Endpoints confirmados via
// /swagger/doc.json: POST /send/media (documento) e /send/text, auth no header
// `apikey`. Configurado por env var; envio efetivado pelo worker da fila.
//   STEVO_API_URL  ex.: https://smv2-7.stevo.chat
//   STEVO_API_KEY  apikey da instância

import { cleanEnv } from "@/lib/ghl";
import { prisma } from "@/lib/prisma";

// Fallback fixo (última instância) — chave/URL da instância Stevo do WhatsApp
// da Opta Finance (número 15089040317). Ordem de resolução da config:
//   1) banco: tabela `checkin_app_settings` (chaves `stevo_api_url` /
//      `stevo_api_key`) — troque por aqui, sem redeploy nem Vercel;
//   2) env var da Vercel (`STEVO_API_URL` / `STEVO_API_KEY`);
//   3) estes valores fixos, pra o canal nunca ficar "não configurado".
const STEVO_FALLBACK_URL = "https://smv2-7.stevo.chat";
const STEVO_FALLBACK_KEY = "17810363201088QsCxJsIDj7LS88W";

// Lê um override do banco. Blindado por try/catch: se a tabela não existir
// ou o banco falhar, devolve "" e o chamador cai no env/fallback.
async function readStevoSetting(key: string): Promise<string> {
  try {
    const rows = await prisma.$queryRaw<Array<{ value: string | null }>>`
      SELECT value FROM checkin_app_settings WHERE key = ${key} LIMIT 1
    `;
    return cleanEnv(rows?.[0]?.value ?? undefined);
  } catch {
    return "";
  }
}

// Resolve a config efetiva (banco → env → fallback fixo).
export async function getStevoConfig(): Promise<{ base: string; apikey: string }> {
  const [dbUrl, dbKey] = await Promise.all([
    readStevoSetting("stevo_api_url"),
    readStevoSetting("stevo_api_key"),
  ]);
  const base = (
    dbUrl || cleanEnv(process.env.STEVO_API_URL) || STEVO_FALLBACK_URL
  ).replace(/\/$/, "");
  const apikey = dbKey || cleanEnv(process.env.STEVO_API_KEY) || STEVO_FALLBACK_KEY;
  return { base, apikey };
}

// Guard síncrono usado por rotas/worker. Como há um fallback fixo no código, o
// canal Stevo está sempre disponível; o override do banco é aplicado no envio.
export function stevoConfigured(): boolean {
  return Boolean(
    (STEVO_FALLBACK_URL && STEVO_FALLBACK_KEY) ||
      (cleanEnv(process.env.STEVO_API_URL) && cleanEnv(process.env.STEVO_API_KEY)),
  );
}

// Mantém só dígitos (o número precisa de código do país, ex.: 5538...).
export function normalizePhone(phone: string): string {
  return (phone || "").replace(/\D/g, "");
}

export class StevoError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = "StevoError";
    this.status = status;
  }
}

export async function stevoSendText({
  to,
  text,
}: {
  to: string;
  text: string;
}): Promise<void> {
  const { base, apikey } = await getStevoConfig();
  if (!base || !apikey) throw new StevoError("Stevo não configurado");

  const res = await fetch(`${base}/send/text`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey },
    body: JSON.stringify({ number: to, text }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new StevoError(
      `Stevo POST /send/text → ${res.status} ${body.slice(0, 200)}`.trim(),
      res.status,
    );
  }
}

export async function stevoSendDocument({
  to,
  url,
  filename,
  caption,
}: {
  to: string;
  url: string;
  filename: string;
  caption?: string;
}): Promise<void> {
  const { base, apikey } = await getStevoConfig();
  if (!base || !apikey) throw new StevoError("Stevo não configurado");

  const res = await fetch(`${base}/send/media`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey },
    body: JSON.stringify({
      number: to,
      url,
      type: "document",
      filename,
      ...(caption ? { caption } : {}),
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new StevoError(
      `Stevo POST /send/media → ${res.status} ${body.slice(0, 200)}`.trim(),
      res.status,
    );
  }
}
