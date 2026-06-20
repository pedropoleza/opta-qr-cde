// Conexão com o HighLevel (Spark). Na V1 a integração usa um Private
// Integration Token por location, fornecido via env (GHL_LOCATION_ID +
// GHL_LOCATION_TOKEN). O OAuth completo + GHLConnection criptografada entram
// na Etapa 4; este módulo isola o acesso para essa migração ser localizada.

const GHL_API_BASE = "https://services.leadconnectorhq.com";
const GHL_API_VERSION = "2021-07-28";

// Limpa valores de env var: remove espaços e aspas que sobram de copiar/colar
// (ex.: GHL_LOCATION_TOKEN="pit-..." vira pit-... sem as aspas).
export function cleanEnv(value?: string | null): string {
  return (value ?? "").trim().replace(/^["']+|["']+$/g, "").trim();
}

function ghlToken(): string {
  return cleanEnv(process.env.GHL_LOCATION_TOKEN);
}

export type GhlConfig = {
  locationId: string | null;
  hasToken: boolean;
  configured: boolean;
};

export function getGhlConfig(): GhlConfig {
  const locationId = cleanEnv(process.env.GHL_LOCATION_ID) || null;
  const hasToken = Boolean(ghlToken());
  return { locationId, hasToken, configured: Boolean(locationId && hasToken) };
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

// Verifica a conexão pingando a location no GHL. Faz fallback gracioso
// (timeout/erro) para não travar a página — a checagem é informativa.
export async function checkGhlConnection(
  timeoutMs = 6000,
): Promise<GhlConnectionStatus> {
  const { locationId, configured } = getGhlConfig();
  if (!configured || !locationId) {
    return { state: "disconnected", locationId };
  }

  const token = ghlToken();
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
// Cliente da API do GHL usado pelo worker da fila (Etapa 4).
// --------------------------------------------------------------------------

export class GhlError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = "GhlError";
    this.status = status;
  }
}

function ghlHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    Version: GHL_API_VERSION,
    Accept: "application/json",
    "Content-Type": "application/json",
  };
}

async function ghlRequest<T = unknown>(
  path: string,
  init: RequestInit & { method: string },
): Promise<T> {
  const token = ghlToken();
  if (!token) throw new GhlError("GHL token não configurado");

  const res = await fetch(`${GHL_API_BASE}${path}`, {
    ...init,
    headers: { ...ghlHeaders(token), ...(init.headers ?? {}) },
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

// Aplica tags no contato. A tag-gatilho (ex.: qrcode-enviado-{slug}) é o que
// dispara o workflow de e-mail no GHL.
export async function ghlAddTags(contactId: string, tags: string[]) {
  await ghlRequest(`/contacts/${contactId}/tags`, {
    method: "POST",
    body: JSON.stringify({ tags }),
  });
}

// Adiciona uma nota ao contato (ex.: confirmação de check-in).
export async function ghlAddNote(contactId: string, note: string) {
  await ghlRequest(`/contacts/${contactId}/notes`, {
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

// Busca contatos da location filtrando por tag (#9). Usa o endpoint de busca
// avançada do GHL (validado: filters[].field=tags, operator=contains).
export async function ghlSearchContactsByTag(
  tag: string,
  pageLimit = 100,
): Promise<GhlContact[]> {
  const { locationId } = getGhlConfig();
  if (!locationId) throw new GhlError("Location não configurada");

  const data = await ghlRequest<{ contacts?: RawContact[] }>(
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

// Lista/busca contatos da location (aba Contatos). Suporta busca textual e
// paginação por startAfter/startAfterId (cursor do GHL).
export async function ghlListContacts(opts: {
  query?: string;
  limit?: number;
  startAfter?: string;
  startAfterId?: string;
}): Promise<{
  contacts: GhlContact[];
  startAfter?: string;
  startAfterId?: string;
}> {
  const { locationId } = getGhlConfig();
  if (!locationId) throw new GhlError("Location não configurada");

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
  }>(`/contacts/?${params.toString()}`, { method: "GET" });

  return {
    contacts: (data.contacts ?? []).map(mapContact),
    startAfter:
      data.meta?.startAfter != null ? String(data.meta.startAfter) : undefined,
    startAfterId: data.meta?.startAfterId,
  };
}

// Mapa nome-do-campo → id, cacheado por alguns minutos. Os custom fields D3
// (event_name, event_date, …) são criados pelo Time na location do GHL.
let customFieldCache: { at: number; map: Record<string, string> } | null = null;
const CUSTOM_FIELD_TTL_MS = 5 * 60 * 1000;

async function getCustomFieldIdMap(): Promise<Record<string, string>> {
  if (customFieldCache && Date.now() - customFieldCache.at < CUSTOM_FIELD_TTL_MS) {
    return customFieldCache.map;
  }
  const { locationId } = getGhlConfig();
  if (!locationId) throw new GhlError("Location não configurada");

  const data = await ghlRequest<{
    customFields?: Array<{ id: string; name?: string; fieldKey?: string }>;
  }>(`/locations/${locationId}/customFields`, { method: "GET" });

  const map: Record<string, string> = {};
  for (const field of data.customFields ?? []) {
    if (!field.id) continue;
    // fieldKey costuma ser "contact.event_name" → indexa por "event_name".
    if (field.fieldKey) {
      const key = field.fieldKey.split(".").pop();
      if (key) map[key.toLowerCase()] = field.id;
    }
    if (field.name) {
      map[field.name.trim().toLowerCase().replace(/\s+/g, "_")] = field.id;
    }
  }
  customFieldCache = { at: Date.now(), map };
  return map;
}

// Atualiza custom fields do contato resolvendo nomes → ids. Falha (com erro
// claro) se nenhum campo existir ainda na location — sinal para o Time criar
// os custom fields D3.
export async function ghlUpdateContactFields(
  contactId: string,
  fields: Record<string, unknown>,
) {
  const map = await getCustomFieldIdMap();
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

  await ghlRequest(`/contacts/${contactId}`, {
    method: "PUT",
    body: JSON.stringify({ customFields }),
  });
}
