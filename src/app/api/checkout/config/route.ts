import { NextRequest, NextResponse } from "next/server";
import {
  squareApplicationId,
  squareLocationId,
  squareEnvironment,
  squareCheckoutConfigured,
} from "@/lib/square-api";
import { resolveCheckout } from "@/lib/checkout";
import { enforceRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

// Config pública que o Web Payments SDK precisa no navegador para montar a
// modal: Application ID + Location ID (públicos) e o VALOR do evento (resolvido
// no servidor pela agenda). Não expõe segredo nem dados de outros convidados.
export async function GET(req: NextRequest) {
  const limited = await enforceRateLimit(req, "checkout-config", 120, 60);
  if (limited) return limited;

  if (!squareCheckoutConfigured()) {
    return NextResponse.json(
      { ok: false, reason: "unconfigured" },
      { status: 503 },
    );
  }

  const url = new URL(req.url);
  const res = await resolveCheckout({
    eventId: url.searchParams.get("e"),
    email: url.searchParams.get("email"),
    phone: url.searchParams.get("phone"),
    name: url.searchParams.get("name"),
    agenda: url.searchParams.get("agenda"),
    tag: url.searchParams.get("tag"),
  });

  if (!res.ok) {
    return NextResponse.json({ ok: false, reason: res.reason }, { status: 422 });
  }

  return NextResponse.json({
    ok: true,
    applicationId: squareApplicationId(),
    locationId: squareLocationId(),
    environment: squareEnvironment(),
    amountCents: res.ctx.amountCents,
    currency: res.ctx.currency,
    eventName: res.ctx.eventName,
    buyerEmail: res.ctx.buyerEmail,
  });
}
