import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";

// Integração de inscrições/pagamentos por evento (F1).

function token(): string {
  return crypto.randomBytes(18).toString("base64url");
}

export async function getOrCreateIntegration(eventId: string) {
  const existing = await prisma.eventIntegration.findUnique({
    where: { eventId },
  });
  if (existing) return existing;
  return prisma.eventIntegration.create({
    data: {
      eventId,
      registrationToken: token(),
      paymentToken: token(),
    },
  });
}

export function appBaseUrl(): string {
  return (
    process.env.APP_BASE_URL?.replace(/\/$/, "") ||
    "https://spark-qrcode-checker.vercel.app"
  );
}

export function registrationWebhookUrl(t: string): string {
  return `${appBaseUrl()}/api/hooks/registration/${t}`;
}
export function squareWebhookUrl(t: string): string {
  return `${appBaseUrl()}/api/hooks/square/${t}`;
}

// Mapeia o corpo do formulário em campos do convidado, com defaults tolerantes.
export function mapRegistration(
  body: Record<string, unknown>,
  fieldMap?: Record<string, string> | null,
): { name: string | null; email: string | null; phone: string | null; ref: string | null } {
  const pick = (keys: string[]): string | null => {
    for (const k of keys) {
      const v = body[k];
      if (v != null && String(v).trim()) return String(v).trim();
    }
    return null;
  };
  const m = fieldMap ?? {};
  return {
    name: pick([m.name, "name", "full_name", "nome", "first_name"].filter(Boolean) as string[]),
    email: pick([m.email, "email", "e-mail", "email_address"].filter(Boolean) as string[]),
    phone: pick([m.phone, "phone", "telefone", "phone_number", "whatsapp"].filter(Boolean) as string[]),
    ref: pick([m.ref, "id", "submission_id", "registration_id"].filter(Boolean) as string[]),
  };
}
