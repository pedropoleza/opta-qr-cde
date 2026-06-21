import { NextRequest, NextResponse } from "next/server";
import { getCheckerSession } from "@/lib/auth";
import { jsonError } from "@/lib/api";
import { validateScan } from "@/lib/checkin";
import { enforceRateLimit } from "@/lib/rate-limit";

// Validação do scan (seções 2.3 e 3.4). Autorização: sessão de Checker
// (escopo do evento, via link + PIN). O modo Checker é a única superfície que
// efetua check-in por scan.
export async function POST(req: NextRequest) {
  // Limite por IP: protege contra varredura/abuso de tokens.
  const limited = await enforceRateLimit(req, "scan-validate", 120, 60);
  if (limited) return limited;

  const body = await req.json().catch(() => ({}));
  const { token, sig, deviceInfo } = body;
  if (!token || !sig) return jsonError(400, "Token e assinatura são obrigatórios");

  const checker = await getCheckerSession();
  if (!checker) return jsonError(401, "Sessão de Checker necessária");

  const result = await validateScan(String(token), String(sig), {
    expectedEventId: checker.eventId,
    checkerUserId: "checker-pin",
    deviceInfo: deviceInfo
      ? String(deviceInfo).slice(0, 500)
      : req.headers.get("user-agent") ?? undefined,
    ipAddress: req.headers.get("x-forwarded-for") ?? undefined,
  });
  return NextResponse.json(result);
}
