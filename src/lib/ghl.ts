// Conexão com o HighLevel por ORGANIZAÇÃO (multi-tenant, Fase 2). A credencial
// vive em checkin_ghl_connections (token cifrado) por org. Fallback para env
// apenas quando não há nenhuma conexão no sistema (modo legado/single-tenant).

import { prisma } from "@/lib/prisma";
import { decryptSecret, encryptSecret } from "@/lib/crypto";
import {
  ghlOAuthConfigured,
  refreshAccessToken,
  type GhlTokenResponse,
} from "@/lib/ghl-oauth";

const GHL_API_BASE = "https://services.leadconnectorhq.com";
const GHL_API_VERSION = "2021-07-28";

const PIT_REFRESH = "pit-no-refresh"; // marcador de conexão por PIT (sem refresh)

export function cleanEnv(value?: string | null): string {
  return (value ?? "").trim().replace(/^["']+|["']+$/g, "").trim();
}

export type GhlAuth = { locationId: string | null; token: string | null };

// Resolve a credencial da organização: conexão do banco (cifrada) → fallback
// env só se NÃO houver nenhuma conexão cadastrada (legado).
export async function resolveGhlAuth(organizationId: string): Promise<GhlAuth> {
  const conn = await prisma.ghlConnection.findFirst({
    where: { organizationId },
    orderBy: { createdAt: "desc" },
  });
  if (conn?.accessToken && conn?.locationId) {
    // Conexão OAuth (Marketplace): renova o token quando expira.
    const isOauth = conn.refreshToken && conn.refreshToken !== PIT_REFRESH;
    const expired = conn.expiresAt.getTime() < Date.now() + 60_000; // 1 min de folga
    if (isOauth && expired && ghlOAuthConfigured()) {
      try {
        const refreshed = await refreshAccessToken(decryptSecret(conn.refreshToken));
        await persistTokens(organizationId, refreshed, conn.locationId);
        return { locationId: conn.locationId, token: refreshed.access_token };
      } catch {
        // Falhou o refresh → tenta com o token atual (pode ainda valer alguns min).
      }
    }
    return { locationId: conn.locationId, token: decryptSecret(conn.accessToken) };
  }
  const total = await prisma.ghlConnection.count();
  if (total === 0) {
    return {
      locationId: cleanEnv(process.env.GHL_LOCATION_ID) || null,
      token: cleanEnv(process.env.GHL_LOCATION_TOKEN) || null,
    };
  }
  return { locationId: null, token: null };
}

export async function ghlConfigured(organizationId: string): Promise<boolean> {
  const { locationId, token } = await resolveGhlAuth(organizationId);
  return Boolean(locationId && token);
}

// Salva/atualiza a conexão da organização (token cifrado em repouso).
export async function saveGhlConnection(
  organizationId: string,
  locationId: string,
  token: string,
) {
  await prisma.ghlConnection.deleteMany({ where: { organizationId } });
  await prisma.ghlConnection.create({
    data: {
      organizationId,
      locationId,
      accessToken: encryptSecret(token),
      refreshToken: "pit-no-refresh",
      expiresAt: new Date("2099-01-01T00:00:00Z"),
      scopes: "private-integration",
    },
  });
}

export async function deleteGhlConnection(organizationId: string) {
  await prisma.ghlConnection.deleteMany({ where: { organizationId } });
}

// Salva a conexão OAuth (Marketplace) — tokens cifrados + expiração + escopos.
export async function saveOauthConnection(
  organizationId: string,
  token: GhlTokenResponse,
  fallbackLocationId?: string,
) {
  const locationId = token.locationId || fallbackLocationId || "";
  await prisma.ghlConnection.deleteMany({ where: { organizationId } });
  await prisma.ghlConnection.create({
    data: {
      organizationId,
      locationId,
      accessToken: encryptSecret(token.access_token),
      refreshToken: encryptSecret(token.refresh_token),
      expiresAt: new Date(Date.now() + (token.expires_in ?? 86400) * 1000),
      scopes: token.scope ?? null,
    },
  });
}

// Atualiza só os tokens (usado no refresh automático).
async function persistTokens(
  organizationId: string,
  token: GhlTokenResponse,
  locationId: string,
) {
  await prisma.ghlConnection.updateMany({
    where: { organizationId },
    data: {
      accessToken: encryptSecret(token.access_token),
      refreshToken: encryptSecret(token.refresh_token),
      expiresAt: new Date(Date.now() + (token.expires_in ?? 86400) * 1000),
      ...(token.scope ? { scopes: token.scope } : {}),
    },
  });
}

// A conexão da org consegue ENVIAR mensagens direto (escopo de Conversations)?
export async function ghlCanMessage(organizationId: string): Promise<boolean> {
  const conn = await prisma.ghlConnection.findFirst({
    where: { organizationId },
    select: { scopes: true, accessToken: true, locationId: true },
  });
  return Boolean(
    conn?.accessToken &&
      conn?.locationId &&
      conn.scopes?.includes("conversations"),
  );
}

export type GhlLocation = {
  id: string;
  name?: string;
  email?: string;
  timezone?: string;
};

export type GhlConnectionStatus =
  | { state: "disconnected"; locationId: string | null }
  | { state: "connected"; locationId: string; location: GhlLocation }
  | { state: "error"; locationId: string | null; message: string };

export async function checkGhlConnection(
  organizationId: string,
  timeoutMs = 6000,
): Promise<GhlConnectionStatus> {
  const { locationId, token } = await resolveGhlAuth(organizationId);
  if (!locationId || !token) return { state: "disconnected", locationId };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${GHL_API_BASE}/locations/${locationId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Version: GHL_API_VERSION,
        Accept: "application/json",
      },
      signal: controller.signal,
      cache: "no-store",
    });
    if (!res.ok) {
      return {
        state: "error",
        locationId,
        message: `O GHL respondeu ${res.status}. Verifique o token e os escopos da integração.`,
      };
    }
    const data = (await res.json().catch(() => ({}))) as {
      location?: GhlLocation;
    } & GhlLocation;
    const loc = data.location ?? data;
    return {
      state: "connected",
      locationId,
      location: {
        id: loc.id ?? locationId,
        name: loc.name,
        email: loc.email,
        timezone: loc.timezone,
      },
    };
  } catch (err) {
    const aborted = err instanceof Error && err.name === "AbortError";
    return {
      state: "error",
      locationId,
      message: aborted
        ? "Tempo de conexão esgotado ao falar com o GHL."
        : "Não foi possível conectar ao GHL.",
    };
  } finally {
    clearTimeout(timer);
  }
}

// --------------------------------------------------------------------------
// Cliente da API do GHL (escopado por organização via GhlAuth).
// --------------------------------------------------------------------------

export class GhlError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = "GhlError";
    this.status = status;
  }
}

async function ghlRequest<T = unknown>(
  token: string,
  path: string,
  init: RequestInit & { method: string },
): Promise<T> {
  const res = await fetch(`${GHL_API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Version: GHL_API_VERSION,
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new GhlError(
      `GHL ${init.method} ${path} → ${res.status} ${body.slice(0, 200)}`.trim(),
      res.status,
    );
  }
  return (await res.json().catch(() => ({}))) as T;
}

async function authOrThrow(organizationId: string): Promise<{ locationId: string; token: string }> {
  const { locationId, token } = await resolveGhlAuth(organizationId);
  if (!locationId || !token) throw new GhlError("GHL não conectado para esta organização");
  return { locationId, token };
}

export async function ghlAddTags(
  organizationId: string,
  contactId: string,
  tags: string[],
) {
  const { token } = await authOrThrow(organizationId);
  await ghlRequest(token, `/contacts/${contactId}/tags`, {
    method: "POST",
    body: JSON.stringify({ tags }),
  });
}

// Templates de e-mail/SMS da conta GHL (location). Usado para escolher um
// template já existente no GHL no agendamento de mensagens.
export type GhlTemplate = { id: string; name: string; type: string; body: string | null };

type RawTemplate = Record<string, unknown>;

function extractTemplateBody(t: RawTemplate): string | null {
  // Vários formatos possíveis conforme o tipo (sms/email) e a versão da API.
  const cand =
    t.body ??
    t.template ??
    t.message ??
    (t.sms as RawTemplate | undefined)?.message ??
    (t.sms as RawTemplate | undefined)?.body ??
    (t.email as RawTemplate | undefined)?.html ??
    (t.email as RawTemplate | undefined)?.body ??
    null;
  if (cand == null) return null;
  const s = String(cand);
  // Se vier HTML (e-mail), reduz para texto legível como ponto de partida.
  if (/<[a-z][\s\S]*>/i.test(s)) {
    return s
      .replace(/<\s*br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|tr|h[1-6])>/gi, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }
  return s;
}

// Diagnóstico: sonda vários endpoints candidatos do GHL (email builder,
// templates, snippets) e retorna status/corpo cru — para achar onde a conta
// guarda os templates de marketing e os snippets.
export async function ghlTemplatesDebug(
  organizationId: string,
): Promise<Record<string, unknown>> {
  const { locationId, token } = await resolveGhlAuth(organizationId);
  if (!locationId || !token)
    return { hasLocation: !!locationId, hasToken: !!token, reason: "sem auth" };

  const candidates = [
    `/emails/builder?locationId=${locationId}&limit=100&offset=0`,
    `/locations/${locationId}/templates?originId=${locationId}&deleted=false&type=email&limit=100&skip=0`,
    `/locations/${locationId}/templates?originId=${locationId}&deleted=false&type=sms&limit=100&skip=0`,
    `/locations/${locationId}/snippets`,
    `/snippets/?locationId=${locationId}`,
  ];
  const out: Record<string, unknown>[] = [];
  for (const path of candidates) {
    try {
      const res = await fetch(`${GHL_API_BASE}${path}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Version: GHL_API_VERSION,
          Accept: "application/json",
        },
        cache: "no-store",
      });
      const text = await res.text().catch(() => "");
      out.push({ path, status: res.status, bodyPreview: text.slice(0, 2500) });
    } catch (e) {
      out.push({ path, fetchError: e instanceof Error ? e.message : String(e) });
    }
  }
  return { locationId, probes: out };
}

export async function ghlListTemplates(
  organizationId: string,
  type: "email" | "sms" = "email",
): Promise<GhlTemplate[]> {
  const { locationId, token } = await authOrThrow(organizationId);

  // E-mail: templates do LC Email Builder (Marketing → Emails).
  if (type === "email") {
    const data = await ghlRequest<{ builders?: RawTemplate[] }>(
      token,
      `/emails/builder?locationId=${locationId}&limit=100&offset=0`,
      { method: "GET" },
    );
    const list = Array.isArray(data.builders) ? data.builders : [];
    return list
      .map((b) => {
        const preview = String(b.previewUrl ?? "");
        const fromUrl = preview.split("emails%2F")[1]?.split(/[%?/]/)[0];
        return {
          id: String(b.id ?? b._id ?? b.templateId ?? fromUrl ?? ""),
          name: String(b.name ?? "Sem nome"),
          type: "email",
          body: null, // conteúdo é HTML no builder; usado via GHL
        };
      })
      .filter((t) => t.id);
  }

  // SMS/Snippets: templates de mensagem curta da conta.
  const qs = new URLSearchParams({
    originId: locationId,
    deleted: "false",
    type: "sms",
    limit: "100",
    skip: "0",
  });
  const data = await ghlRequest<{ templates?: RawTemplate[] }>(
    token,
    `/locations/${locationId}/templates?${qs.toString()}`,
    { method: "GET" },
  );
  const list = Array.isArray(data.templates) ? data.templates : [];
  return list
    .map((t) => ({
      id: String(t.id ?? t._id ?? ""),
      name: String(t.name ?? t.templateName ?? "Sem nome"),
      type: "sms",
      body: extractTemplateBody(t),
    }))
    .filter((t) => t.id);
}

export async function ghlAddNote(
  organizationId: string,
  contactId: string,
  note: string,
) {
  const { token } = await authOrThrow(organizationId);
  await ghlRequest(token, `/contacts/${contactId}/notes`, {
    method: "POST",
    body: JSON.stringify({ body: note }),
  });
}

// Envio direto pela API de Conversations do GHL (e-mail/SMS/WhatsApp).
export type GhlMessage = {
  contactId: string;
  type: "Email" | "SMS" | "WhatsApp";
  subject?: string;
  html?: string;
  message?: string;
  attachments?: string[]; // URLs (e-mail)
};

export async function ghlSendMessage(
  organizationId: string,
  msg: GhlMessage,
): Promise<void> {
  const { token } = await authOrThrow(organizationId);
  const body: Record<string, unknown> = {
    type: msg.type,
    contactId: msg.contactId,
  };
  if (msg.type === "Email") {
    if (msg.subject) body.subject = msg.subject;
    if (msg.html) body.html = msg.html;
    if (msg.message) body.message = msg.message;
    if (msg.attachments?.length) body.attachments = msg.attachments;
  } else {
    body.message = msg.message ?? "";
  }
  await ghlRequest(token, `/conversations/messages`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export type GhlContact = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  tags: string[];
};

type RawContact = {
  id: string;
  contactName?: string;
  firstName?: string;
  lastName?: string;
  email?: string | null;
  phone?: string | null;
  tags?: string[];
};

function mapContact(c: RawContact): GhlContact {
  return {
    id: c.id,
    name:
      c.contactName ||
      [c.firstName, c.lastName].filter(Boolean).join(" ").trim() ||
      c.email ||
      "Sem nome",
    email: c.email ?? null,
    phone: c.phone ?? null,
    tags: Array.isArray(c.tags) ? c.tags : [],
  };
}

export async function ghlSearchContactsByTag(
  organizationId: string,
  tag: string,
  pageLimit = 100,
): Promise<GhlContact[]> {
  const { locationId, token } = await authOrThrow(organizationId);
  const data = await ghlRequest<{ contacts?: RawContact[] }>(
    token,
    `/contacts/search`,
    {
      method: "POST",
      body: JSON.stringify({
        locationId,
        page: 1,
        pageLimit,
        filters: [{ field: "tags", operator: "contains", value: tag }],
      }),
    },
  );
  return (data.contacts ?? []).map(mapContact);
}

export async function ghlListContacts(
  organizationId: string,
  opts: { query?: string; limit?: number; startAfter?: string; startAfterId?: string },
): Promise<{ contacts: GhlContact[]; startAfter?: string; startAfterId?: string }> {
  const { locationId, token } = await authOrThrow(organizationId);
  const params = new URLSearchParams({
    locationId,
    limit: String(opts.limit ?? 25),
  });
  if (opts.query) params.set("query", opts.query);
  if (opts.startAfter) params.set("startAfter", opts.startAfter);
  if (opts.startAfterId) params.set("startAfterId", opts.startAfterId);

  const data = await ghlRequest<{
    contacts?: RawContact[];
    meta?: { startAfter?: number | string; startAfterId?: string };
  }>(token, `/contacts/?${params.toString()}`, { method: "GET" });

  return {
    contacts: (data.contacts ?? []).map(mapContact),
    startAfter:
      data.meta?.startAfter != null ? String(data.meta.startAfter) : undefined,
    startAfterId: data.meta?.startAfterId,
  };
}

// Mapa nome-do-campo → id, cacheado por org.
const customFieldCache = new Map<string, { at: number; map: Record<string, string> }>();
const CUSTOM_FIELD_TTL_MS = 5 * 60 * 1000;

async function getCustomFieldIdMap(organizationId: string): Promise<Record<string, string>> {
  const cached = customFieldCache.get(organizationId);
  if (cached && Date.now() - cached.at < CUSTOM_FIELD_TTL_MS) return cached.map;

  const { locationId, token } = await authOrThrow(organizationId);
  const data = await ghlRequest<{
    customFields?: Array<{ id: string; name?: string; fieldKey?: string }>;
  }>(token, `/locations/${locationId}/customFields`, { method: "GET" });

  const map: Record<string, string> = {};
  for (const field of data.customFields ?? []) {
    if (!field.id) continue;
    if (field.fieldKey) {
      const k = field.fieldKey.split(".").pop();
      if (k) map[k.toLowerCase()] = field.id;
    }
    if (field.name) {
      map[field.name.trim().toLowerCase().replace(/\s+/g, "_")] = field.id;
    }
  }
  customFieldCache.set(organizationId, { at: Date.now(), map });
  return map;
}

// Campos que o app grava no contato (viram as variáveis do e-mail no workflow).
export const SPARK_CONTACT_FIELDS = [
  "guest_name",
  "event_name",
  "event_date",
  "event_time",
  "event_location",
  "event_address",
  "event_qr_link",
  "event_qr_image",
  "event_pdf_link",
  "event_checkin_status",
] as const;

// Cria no Spark (location) os custom fields que faltam, para o workflow do
// cliente ter todas as variáveis. Idempotente.
export async function ensureGhlCustomFields(
  organizationId: string,
): Promise<{ created: string[]; existing: string[]; failed: string[] }> {
  const { locationId, token } = await authOrThrow(organizationId);
  const data = await ghlRequest<{
    customFields?: Array<{ id: string; name?: string; fieldKey?: string }>;
  }>(token, `/locations/${locationId}/customFields`, { method: "GET" });

  const present = new Set<string>();
  for (const f of data.customFields ?? []) {
    if (f.fieldKey) present.add(f.fieldKey.split(".").pop()!.toLowerCase());
    if (f.name) present.add(f.name.trim().toLowerCase().replace(/\s+/g, "_"));
  }

  const created: string[] = [];
  const existing: string[] = [];
  const failed: string[] = [];
  for (const key of SPARK_CONTACT_FIELDS) {
    if (present.has(key)) {
      existing.push(key);
      continue;
    }
    try {
      await ghlRequest(token, `/locations/${locationId}/customFields`, {
        method: "POST",
        body: JSON.stringify({ name: key, dataType: "TEXT", model: "contact" }),
      });
      created.push(key);
    } catch {
      failed.push(key);
    }
  }
  customFieldCache.delete(organizationId); // força recarregar o mapa
  return { created, existing, failed };
}

export async function ghlUpdateContactFields(
  organizationId: string,
  contactId: string,
  fields: Record<string, unknown>,
) {
  const { token } = await authOrThrow(organizationId);
  const map = await getCustomFieldIdMap(organizationId);
  const customFields: Array<{ id: string; field_value: unknown }> = [];
  const missing: string[] = [];

  for (const [key, value] of Object.entries(fields)) {
    const id = map[key.toLowerCase()];
    if (id) customFields.push({ id, field_value: value });
    else missing.push(key);
  }

  if (customFields.length === 0) {
    throw new GhlError(
      `Nenhum custom field encontrado na location (faltando: ${missing.join(", ")}). Crie os campos D3 no GHL.`,
    );
  }

  await ghlRequest(token, `/contacts/${contactId}`, {
    method: "PUT",
    body: JSON.stringify({ customFields }),
  });
}
