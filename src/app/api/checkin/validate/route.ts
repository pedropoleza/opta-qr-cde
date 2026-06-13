import { NextRequest, NextResponse } from "next/server";
import { getCheckerSession, getOrganizerSession } from "@/lib/auth";
import { jsonError, findOrgEvent } from "@/lib/api";
import { validateScan } from "@/lib/checkin";

// Validação do scan (seções 2.3 e 3.4). Autorização: sessão de Checker
// (escopo do evento, via PIN) ou sessão de organizador informando eventId.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { token, sig, deviceInfo } = body;
  if (!token || !sig) return jsonError(400, "Token e assinatura são obrigatórios");

  let expectedEventId: string | null = null;
  let checkerUserId: string | undefined;

  const checker = await getCheckerSession();
  if (checker) {
    expectedEventId = checker.eventId;
    checkerUserId = "checker-pin";
  } else {
    const organizer = await getOrganizerSession();
    if (organizer && body.eventId) {
      const event = await findOrgEvent(String(body.eventId), organizer.organizationId);
      if (!event) return jsonError(404, "Evento não encontrado");
      expectedEventId = event.id;
      checkerUserId = organizer.userId;
    }
  }
  if (!expectedEventId) return jsonError(401, "Sessão de Checker necessária");

  const result = await validateScan(String(token), String(sig), {
    expectedEventId,
    checkerUserId,
    deviceInfo: deviceInfo ? String(deviceInfo).slice(0, 500) : req.headers.get("user-agent") ?? undefined,
    ipAddress: req.headers.get("x-forwarded-for") ?? undefined,
  });
  return NextResponse.json(result);
}
