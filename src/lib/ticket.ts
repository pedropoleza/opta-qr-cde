import { createHmac, randomUUID, timingSafeEqual } from "crypto";

// Geração do token do QR Code (seção 2.4):
//   ticket_token = base64url(random_uuid_v4)
//   assinatura   = HMAC_SHA256(event_id + guest_id + ticket_token, TICKET_TOKEN_SECRET)
//   URL no QR    = {APP_BASE_URL}/checkin/validate?token={token}&sig={assinatura}

function secret(): string {
  const s = process.env.TICKET_TOKEN_SECRET;
  if (!s) throw new Error("TICKET_TOKEN_SECRET não configurado");
  return s;
}

export function generateTicketToken(): string {
  return Buffer.from(randomUUID()).toString("base64url");
}

export function signTicket(eventId: string, guestId: string, token: string): string {
  return createHmac("sha256", secret())
    .update(eventId + guestId + token)
    .digest("base64url");
}

export function verifyTicketSignature(
  eventId: string,
  guestId: string,
  token: string,
  signature: string
): boolean {
  const expected = signTicket(eventId, guestId, token);
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function ticketValidationUrl(token: string, signature: string): string {
  const base = process.env.APP_BASE_URL ?? "http://localhost:3000";
  return `${base}/checkin/validate?token=${encodeURIComponent(token)}&sig=${encodeURIComponent(signature)}`;
}

export function ticketPublicQrUrl(token: string): string {
  const base = process.env.APP_BASE_URL ?? "http://localhost:3000";
  return `${base}/q/${encodeURIComponent(token)}`;
}

// PNG público do QR — usado como <img src> dentro do e-mail enviado pelo GHL.
export function ticketQrImageUrl(token: string): string {
  const base = process.env.APP_BASE_URL ?? "http://localhost:3000";
  return `${base}/api/qr/${encodeURIComponent(token)}`;
}

// PDF público do ingresso — usado como mídia no envio por WhatsApp (Stevo).
export function ticketPdfUrl(token: string): string {
  const base = process.env.APP_BASE_URL ?? "http://localhost:3000";
  return `${base}/api/ticket/${encodeURIComponent(token)}/pdf`;
}

export function ticketBadgeUrl(token: string): string {
  return `/api/ticket/${encodeURIComponent(token)}/badge`;
}

export function ticketCertificateUrl(token: string): string {
  const base = process.env.APP_BASE_URL ?? "http://localhost:3000";
  return `${base}/api/ticket/${encodeURIComponent(token)}/certificate`;
}

export function npsUrl(token: string): string {
  const base = process.env.APP_BASE_URL ?? "http://localhost:3000";
  return `${base}/nps/${encodeURIComponent(token)}`;
}
