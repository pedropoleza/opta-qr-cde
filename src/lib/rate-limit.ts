import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Rate limiting por janela fixa (Fase 5 — escala). Atômico no Postgres via um
// único UPSERT, então funciona no serverless (sem estado em memória) e entre
// instâncias. "Falha aberto": qualquer erro do limiter libera a requisição —
// nunca derruba a rota por causa de si mesmo.

export type RateResult = {
  ok: boolean;
  remaining: number;
  limit: number;
  retryAfter: number; // segundos até a janela reabrir
};

export async function rateLimit(
  key: string,
  limit: number,
  windowSec: number,
): Promise<RateResult> {
  try {
    const rows = await prisma.$queryRaw<{ count: number; window_start: Date }[]>`
      INSERT INTO checkin_rate_limits (key, window_start, count)
      VALUES (${key}, now(), 1)
      ON CONFLICT (key) DO UPDATE SET
        count = CASE
          WHEN checkin_rate_limits.window_start < now() - make_interval(secs => ${windowSec}::double precision)
          THEN 1 ELSE checkin_rate_limits.count + 1 END,
        window_start = CASE
          WHEN checkin_rate_limits.window_start < now() - make_interval(secs => ${windowSec}::double precision)
          THEN now() ELSE checkin_rate_limits.window_start END
      RETURNING count, window_start;
    `;
    const row = rows[0];
    const count = Number(row?.count ?? 1);
    const windowStart = row?.window_start ? new Date(row.window_start) : new Date();
    const resetAt = windowStart.getTime() + windowSec * 1000;
    const retryAfter = Math.max(0, Math.ceil((resetAt - Date.now()) / 1000));
    return {
      ok: count <= limit,
      remaining: Math.max(0, limit - count),
      limit,
      retryAfter,
    };
  } catch {
    return { ok: true, remaining: limit, limit, retryAfter: 0 };
  }
}

// IP do cliente atrás do proxy da Vercel.
export function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

// Resposta 429 padrão com Retry-After.
export function tooManyRequests(retryAfter: number): NextResponse {
  return NextResponse.json(
    { error: "Muitas requisições. Tente novamente em instantes." },
    { status: 429, headers: { "Retry-After": String(Math.max(1, retryAfter)) } },
  );
}

// Açúcar: aplica o limiter e já devolve a resposta 429 quando estourar.
// Retorna null quando liberado. `bucket` é o nome lógico da rota.
export async function enforceRateLimit(
  req: Request,
  bucket: string,
  limit: number,
  windowSec: number,
  extraKey?: string,
): Promise<NextResponse | null> {
  const id = extraKey ? `${extraKey}` : clientIp(req);
  const result = await rateLimit(`${bucket}:${id}`, limit, windowSec);
  return result.ok ? null : tooManyRequests(result.retryAfter);
}
