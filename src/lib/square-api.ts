import { cleanEnv } from "@/lib/ghl";

// Cliente mínimo da Square API (sem SDK). Usado para:
//  - criar o link inteligente de pagamento por convidado (reference_id/order),
//  - conciliar pagamentos (Payments API) como rede de segurança.
//
// Config por env (Vercel): SQUARE_ACCESS_TOKEN, SQUARE_LOCATION_ID,
// SQUARE_ENVIRONMENT (production|sandbox).

const SQUARE_VERSION = "2025-01-23";

export function squareEnvironment(): "production" | "sandbox" {
  return cleanEnv(process.env.SQUARE_ENVIRONMENT) === "sandbox"
    ? "sandbox"
    : "production";
}

function squareBase(): string {
  return squareEnvironment() === "sandbox"
    ? "https://connect.squareupsandbox.com"
    : "https://connect.squareup.com";
}

export function squareToken(): string {
  return cleanEnv(process.env.SQUARE_ACCESS_TOKEN);
}

export function squareLocationId(): string {
  return cleanEnv(process.env.SQUARE_LOCATION_ID);
}

export function squareConfigured(): boolean {
  return Boolean(squareToken() && squareLocationId());
}

export class SquareError extends Error {
  constructor(
    message: string,
    public status: number,
    public errors?: unknown,
  ) {
    super(message);
  }
}

async function squareRequest<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(`${squareBase()}${path}`, {
    ...init,
    headers: {
      "Square-Version": SQUARE_VERSION,
      Authorization: `Bearer ${squareToken()}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) {
    const detail = data?.errors?.[0]?.detail ?? `HTTP ${res.status}`;
    throw new SquareError(detail, res.status, data?.errors);
  }
  return data as T;
}

export type PaymentLink = {
  id: string;
  orderId: string | null;
  url: string; // square.link curta — ideal para a mensagem
  longUrl: string | null;
};

// Cria um link de pagamento por convidado. O order carrega reference_id (id do
// convidado) e é a chave de conciliação determinística no webhook (order_id).
export async function createPaymentLink(opts: {
  name: string;
  amountCents: number;
  currency: string;
  referenceId: string;
  buyerEmail?: string | null;
  redirectUrl?: string | null;
  note?: string | null;
}): Promise<PaymentLink> {
  const body: Record<string, unknown> = {
    idempotency_key: `optapay-${opts.referenceId}`.slice(0, 45),
    order: {
      location_id: squareLocationId(),
      reference_id: opts.referenceId,
      line_items: [
        {
          name: opts.name.slice(0, 500),
          quantity: "1",
          base_price_money: { amount: opts.amountCents, currency: opts.currency },
        },
      ],
    },
    checkout_options: {
      ask_for_shipping_address: false,
      ...(opts.redirectUrl ? { redirect_url: opts.redirectUrl } : {}),
    },
  };
  // O Square rejeita e-mail inválido; só pré-preenche quando parece válido.
  if (opts.buyerEmail && /.+@.+\..+/.test(opts.buyerEmail)) {
    body.pre_populated_data = { buyer_email: opts.buyerEmail };
  }
  if (opts.note) {
    (body.order as Record<string, unknown>).line_items = [
      {
        name: opts.name.slice(0, 500),
        quantity: "1",
        base_price_money: { amount: opts.amountCents, currency: opts.currency },
        note: opts.note.slice(0, 500),
      },
    ];
  }

  const data = await squareRequest<{
    payment_link?: { id?: string; order_id?: string; url?: string; long_url?: string };
  }>("/v2/online-checkout/payment-links", {
    method: "POST",
    body: JSON.stringify(body),
  });
  const pl = data.payment_link ?? {};
  if (!pl.url || !pl.id) {
    throw new SquareError("Resposta sem link de pagamento", 502);
  }
  return {
    id: pl.id,
    orderId: pl.order_id ?? null,
    url: pl.url,
    longUrl: pl.long_url ?? null,
  };
}

export type SquarePaymentSummary = {
  id: string;
  status: string;
  amount: number | null;
  currency: string | null;
  email: string | null;
  orderId: string | null;
  referenceId: string | null;
  createdAt: string | null;
};

// Lista pagamentos recentes (para conciliação). beginTime em ISO-8601.
export async function listRecentPayments(
  beginTimeIso: string,
  limit = 100,
): Promise<SquarePaymentSummary[]> {
  const params = new URLSearchParams({
    begin_time: beginTimeIso,
    sort_order: "DESC",
    location_id: squareLocationId(),
    limit: String(limit),
  });
  const data = await squareRequest<{
    payments?: Array<Record<string, unknown>>;
  }>(`/v2/payments?${params.toString()}`, { method: "GET" });
  return (data.payments ?? []).map((p) => {
    const money = (p.amount_money ?? {}) as Record<string, unknown>;
    return {
      id: String(p.id ?? ""),
      status: String(p.status ?? ""),
      amount: money.amount != null ? Number(money.amount) : null,
      currency: (money.currency as string | undefined) ?? null,
      email: (p.buyer_email_address as string | undefined)?.toLowerCase() ?? null,
      orderId: (p.order_id as string | undefined) ?? null,
      referenceId: (p.reference_id as string | undefined) ?? null,
      createdAt: (p.created_at as string | undefined) ?? null,
    };
  });
}

// Cria/garante a subscription de webhook apontando para a nossa URL. Retorna a
// signature key (que só é revelada na criação).
export async function createWebhookSubscription(
  notificationUrl: string,
  eventTypes: string[],
): Promise<{ id: string; signatureKey: string }> {
  const data = await squareRequest<{
    subscription?: { id?: string; signature_key?: string };
  }>("/v2/webhooks/subscriptions", {
    method: "POST",
    body: JSON.stringify({
      idempotency_key: `optahook-${notificationUrl}`.slice(0, 45),
      subscription: {
        name: "Opta Finance — eventos",
        event_types: eventTypes,
        notification_url: notificationUrl,
        api_version: SQUARE_VERSION,
      },
    }),
  });
  const s = data.subscription ?? {};
  if (!s.id || !s.signature_key) {
    throw new SquareError("Subscription criada sem signature key", 502);
  }
  return { id: s.id, signatureKey: s.signature_key };
}
