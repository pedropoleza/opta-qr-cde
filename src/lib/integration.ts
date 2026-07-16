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
    "https://eventos.optafinance.com"
  );
}

export function registrationWebhookUrl(t: string): string {
  return `${appBaseUrl()}/api/hooks/registration/${t}`;
}
export function squareWebhookUrl(t: string): string {
  return `${appBaseUrl()}/api/hooks/square/${t}`;
}

// Webhook de LEADS (entrada por formulário do GHL). Uma única URL por
// organização, identificada pelo locationId do GHL; o evento é resolvido pelo
// campo "Agenda" do payload. O token é o locationId (o mesmo já presente na URL
// do webhook do GHL), então não precisamos de coluna/segredo novo no banco.
export function leadWebhookUrl(locationId: string): string {
  return `${appBaseUrl()}/api/hooks/lead/${locationId}`;
}

// Normaliza um texto de "Agenda"/nome de evento para comparação tolerante:
// remove emojis/símbolos e acentos, colapsa espaços e caixa. Ex.:
// "☕ Café com Elas" e "cafe com elas" passam a bater.
export function normalizeAgenda(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // remove acentos (marcas combinantes)
    .replace(/[^a-zA-Z0-9\s]/g, " ") // remove emojis/símbolos/pontuação
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

// Escolhe o evento de uma organização que corresponde ao texto da "Agenda".
// Estratégia: match normalizado exato → um dos nomes contido no outro. Entre
// candidatos, prefere eventos não encerrados e o mais recente por data.
export function pickEventForAgenda<
  E extends { id: string; name: string; date: Date; status: string },
>(events: E[], agenda: string): E | null {
  const target = normalizeAgenda(agenda);
  if (!target) return null;

  const scored = events
    .map((e) => {
      const n = normalizeAgenda(e.name);
      let score = 0;
      if (n === target) score = 3;
      else if (n && target.includes(n)) score = 2;
      else if (n && n.includes(target)) score = 1;
      return { e, score };
    })
    .filter((s) => s.score > 0);

  if (scored.length === 0) return null;

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const openA = ["canceled", "completed"].includes(a.e.status) ? 0 : 1;
    const openB = ["canceled", "completed"].includes(b.e.status) ? 0 : 1;
    if (openA !== openB) return openB - openA;
    return b.e.date.getTime() - a.e.date.getTime();
  });
  return scored[0].e;
}

// Mapeia o corpo do formulário de LEAD do GHL nos campos do convidado. O GHL
// envia { name, email, phone, agenda, address, date, time, ... }.
export function mapLeadForm(body: Record<string, unknown>): {
  name: string | null;
  email: string | null;
  phone: string | null;
  agenda: string | null;
  ghlContactId: string | null;
  ref: string | null;
} {
  const pick = (keys: string[]): string | null => {
    for (const k of keys) {
      // procura de forma tolerante a caixa/acento na chave
      const found = Object.keys(body).find(
        (bk) => normalizeAgenda(bk) === normalizeAgenda(k),
      );
      const v = found != null ? body[found] : body[k];
      if (v != null && String(v).trim()) return String(v).trim();
    }
    return null;
  };
  const first = pick(["first_name", "firstName", "first name"]);
  const last = pick(["last_name", "lastName", "last name"]);
  const full = pick(["name", "full_name", "nome", "fullName"]);
  const name = full ?? ([first, last].filter(Boolean).join(" ").trim() || null);
  return {
    name: name || null,
    email: pick(["email", "e-mail", "email_address", "emailAddress"]),
    phone: pick(["phone", "telefone", "phone_number", "phoneNumber", "whatsapp"]),
    agenda: pick(["agenda", "evento", "event", "calendar"]),
    ghlContactId: pick(["contact_id", "contactId", "ghl_contact_id"]),
    ref: pick(["id", "submission_id", "submissionId", "registration_id"]),
  };
}

// Mapeia o corpo do formulário em campos do convidado, com defaults tolerantes.
export function mapRegistration(
  body: Record<string, unknown>,
  fieldMap?: Record<string, string> | null,
): {
  name: string | null;
  email: string | null;
  phone: string | null;
  ref: string | null;
  ghlContactId: string | null;
} {
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
    ghlContactId: pick(
      [m.ghlContactId, "contact_id", "ghl_contact_id", "contactId"].filter(Boolean) as string[],
    ),
  };
}
