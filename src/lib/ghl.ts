// Conexão com o HighLevel por ORGANIZAÇÃO (multi-tenant, Fase 2). A credencial
// vive em checkin_ghl_connections (token cifrado) por org. Fallback para env
// apenas quando não há nenhuma conexão no sistema (modo legado/single-tenant).

import { prisma } from "@/lib/prisma";
import { decryptSecret, encryptSecret } from "@/lib/crypto";

const GHL_API_BASE = "https://services.leadconnectorhq.com";
const GHL_API_VERSION = "2021-07-28";

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
