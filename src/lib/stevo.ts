// Cliente do Stevo (WhatsApp API estilo wuzapi). Endpoints confirmados via
// /swagger/doc.json: POST /send/media (documento) e /send/text, auth no header
// `apikey`. Configurado por env var; envio efetivado pelo worker da fila.
//   STEVO_API_URL  ex.: https://smv2-7.stevo.chat
//   STEVO_API_KEY  apikey da instância

import { cleanEnv } from "@/lib/ghl";

export function stevoConfigured(): boolean {
  return Boolean(cleanEnv(process.env.STEVO_API_URL) && cleanEnv(process.env.STEVO_API_KEY));
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
  const base = cleanEnv(process.env.STEVO_API_URL).replace(/\/$/, "");
  const apikey = cleanEnv(process.env.STEVO_API_KEY);
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
