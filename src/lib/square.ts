import crypto from "node:crypto";

// Verificação e parsing dos webhooks do Square (F1 — pagamentos).
// O Square assina cada webhook com HMAC-SHA256 sobre (notificationUrl + corpo
// bruto), em base64, no header x-square-hmacsha256-signature.

export function verifySquareSignature(
  signatureKey: string,
  notificationUrl: string,
  rawBody: string,
  signatureHeader: string | null,
): boolean {
  if (!signatureKey || !signatureHeader) return false;
  const hmac = crypto.createHmac("sha256", signatureKey);
  hmac.update(notificationUrl + rawBody);
  const expected = hmac.digest("base64");
  try {
    const a = Buffer.from(expected);
    const b = Buffer.from(signatureHeader);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export type SquarePayment = {
  externalId: string; // id do evento Square (idempotência)
  type: string;
  status: string; // COMPLETED|APPROVED|...
  email: string | null;
  amount: number | null; // centavos
  currency: string | null;
  paymentRef: string | null; // id do pagamento
  referenceId: string | null; // reference_id da order, quando houver
  isRefund: boolean;
};

// Extrai o essencial do payload do Square sem depender do SDK.
export function parseSquarePayment(body: unknown): SquarePayment | null {
  const b = body as Record<string, unknown>;
  if (!b || typeof b !== "object") return null;
  const type = String(b.type ?? "");
  const data = (b.data ?? {}) as Record<string, unknown>;
  const object = (data.object ?? {}) as Record<string, unknown>;
  const isRefund = type.startsWith("refund");
  const payment = (object.payment ?? object.refund ?? {}) as Record<string, unknown>;

  const amountMoney = (payment.amount_money ?? {}) as Record<string, unknown>;
  return {
    externalId: String(b.event_id ?? b.id ?? payment.id ?? ""),
    type,
    status: String(payment.status ?? ""),
    email:
      (payment.buyer_email_address as string | undefined)?.toLowerCase() ?? null,
    amount: amountMoney.amount != null ? Number(amountMoney.amount) : null,
    currency: (amountMoney.currency as string | undefined) ?? null,
    paymentRef: (payment.id as string | undefined) ?? null,
    referenceId: (payment.reference_id as string | undefined) ?? null,
    isRefund,
  };
}
