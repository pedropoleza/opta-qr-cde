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

// ID público do app no Square (Developer Dashboard). Usado pelo Web Payments
// SDK no navegador para renderizar os campos de cartão/wallet. É público por
// design (não é segredo) — o segredo é o SQUARE_ACCESS_TOKEN (server-side).
export function squareApplicationId(): string {
  return cleanEnv(process.env.SQUARE_APPLICATION_ID);
}

export function squareConfigured(): boolean {
  return Boolean(squareToken() && squareLocationId());
}

// Pronto para cobrança embutida (Web Payments SDK)? Precisa também do App ID.
export function squareCheckoutConfigured(): boolean {
  return Boolean(squareConfigured() && squareApplicationId());
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

export type CreatedPayment = {
  id: string;
  status: string; // APPROVED | COMPLETED | PENDING | FAILED | CANCELED
  receiptUrl: string | null;
};

// Cobra o token (source_id) gerado pelo Web Payments SDK no navegador — cartão,
// Google Pay, Apple Pay ou Cash App Pay. O valor vem SEMPRE do servidor (nunca
// do cliente). reference_id = id do convidado, para o pagamento chegar
// identificado e reaproveitar a conciliação existente.
export async function createPayment(opts: {
  sourceId: string;
  amountCents: number;
  currency: string;
  idempotencyKey: string;
  referenceId?: string | null;
  buyerEmail?: string | null;
  verificationToken?: string | null; // SCA/3DS (verifyBuyer do SDK), quando houver
  note?: string | null;
}): Promise<CreatedPayment> {
  const body: Record<string, unknown> = {
    idempotency_key: opts.idempotencyKey.slice(0, 45),
    source_id: opts.sourceId,
    amount_money: { amount: opts.amountCents, currency: opts.currency },
    location_id: squareLocationId(),
    autocomplete: true,
  };
  if (opts.referenceId) body.reference_id = opts.referenceId;
  if (opts.buyerEmail && /.+@.+\..+/.test(opts.buyerEmail))
    body.buyer_email_address = opts.buyerEmail;
  if (opts.verificationToken) body.verification_token = opts.verificationToken;
  if (opts.note) body.note = opts.note.slice(0, 500);

  const data = await squareRequest<{
    payment?: { id?: string; status?: string; receipt_url?: string };
  }>("/v2/payments", { method: "POST", body: JSON.stringify(body) });
  const p = data.payment ?? {};
  if (!p.id) throw new SquareError("Resposta sem pagamento", 502);
  return { id: p.id, status: p.status ?? "UNKNOWN", receiptUrl: p.receipt_url ?? null };
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

function mapPayment(p: Record<string, unknown>): SquarePaymentSummary {
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
}

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
  return (data.payments ?? []).map(mapPayment);
}

// Lista TODOS os pagamentos desde beginTime, paginando pelo cursor do Square e
// em ordem ASCENDENTE (mais antigo primeiro) — ideal para avançar um cursor
// durável de conciliação sem perder nada. `maxPages` é uma trava de segurança.
// Diferente de listRecentPayments, NÃO engole erro: propaga SquareError para o
// chamador registrar/observar (token/subscription quebrada não pode ser mudo).
export async function listPaymentsSince(
  beginTimeIso: string,
  maxPages = 20,
): Promise<SquarePaymentSummary[]> {
  const out: SquarePaymentSummary[] = [];
  let cursor: string | null = null;
  for (let page = 0; page < maxPages; page++) {
    const params = new URLSearchParams({
      begin_time: beginTimeIso,
      sort_order: "ASC",
      location_id: squareLocationId(),
      limit: "100",
    });
    if (cursor) params.set("cursor", cursor);
    const data: { payments?: Array<Record<string, unknown>>; cursor?: string } =
      await squareRequest(`/v2/payments?${params.toString()}`, { method: "GET" });
    for (const p of data.payments ?? []) out.push(mapPayment(p));
    if (!data.cursor) break;
    cursor = data.cursor;
  }
  return out;
}

// Lê o reference_id de um pedido (order). O link inteligente grava
// reference_id = id do convidado no pedido; mas o pagamento em si costuma vir
// SEM reference_id (e às vezes com um order_id diferente do template do link).
// Buscar o pedido resolve o convidado de forma determinística, independe do
// e-mail que o comprador usou no checkout. Best-effort: retorna null se falhar.
export async function getOrderReferenceId(orderId: string): Promise<string | null> {
  try {
    const data = await squareRequest<{ order?: { reference_id?: string } }>(
      `/v2/orders/${encodeURIComponent(orderId)}`,
      { method: "GET" },
    );
    const ref = data.order?.reference_id;
    return ref && ref.trim() ? ref.trim() : null;
  } catch {
    return null;
  }
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

export type CatalogEventItem = {
  itemId: string; // id do ITEM no catálogo do Square (chave de vínculo)
  variationId: string | null; // variação usada para o preço
  name: string;
  priceCents: number | null;
  currency: string;
};

// Lista os itens do CATÁLOGO do Square (produtos com nome + preço). É a fonte
// da verdade do sincronizador: cada item vira/atualiza um evento no painel.
// Usa a primeira variação com preço fixo do item.
export async function listCatalogItems(): Promise<CatalogEventItem[]> {
  const out: CatalogEventItem[] = [];
  let cursor: string | undefined;
  let pages = 0;
  do {
    const params = new URLSearchParams({ types: "ITEM" });
    if (cursor) params.set("cursor", cursor);
    const data = await squareRequest<{
      objects?: Array<Record<string, unknown>>;
      cursor?: string;
    }>(`/v2/catalog/list?${params.toString()}`, { method: "GET" });

    for (const obj of data.objects ?? []) {
      if (obj.is_deleted) continue;
      const itemData = (obj.item_data ?? {}) as Record<string, unknown>;
      const name = String(itemData.name ?? "").trim();
      if (!name) continue;
      const variations = (itemData.variations ?? []) as Array<Record<string, unknown>>;
      // Primeira variação com preço fixo.
      let variationId: string | null = null;
      let priceCents: number | null = null;
      let currency = "USD";
      for (const v of variations) {
        const vd = (v.item_variation_data ?? {}) as Record<string, unknown>;
        const money = (vd.price_money ?? {}) as Record<string, unknown>;
        if (money.amount != null) {
          variationId = String(v.id ?? "") || null;
          priceCents = Number(money.amount);
          currency = (money.currency as string | undefined) ?? "USD";
          break;
        }
      }
      out.push({ itemId: String(obj.id ?? ""), variationId, name, priceCents, currency });
    }
    cursor = data.cursor;
  } while (cursor && ++pages < 20);
  return out;
}
