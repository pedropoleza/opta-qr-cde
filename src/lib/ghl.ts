// Conexão com o HighLevel (Spark). Na V1 a integração usa um Private
// Integration Token por location, fornecido via env (GHL_LOCATION_ID +
// GHL_LOCATION_TOKEN). O OAuth completo + GHLConnection criptografada entram
// na Etapa 4; este módulo isola o acesso para essa migração ser localizada.

const GHL_API_BASE = "https://services.leadconnectorhq.com";
const GHL_API_VERSION = "2021-07-28";

export type GhlConfig = {
  locationId: string | null;
  hasToken: boolean;
  configured: boolean;
};

export function getGhlConfig(): GhlConfig {
  const locationId = process.env.GHL_LOCATION_ID?.trim() || null;
  const hasToken = Boolean(process.env.GHL_LOCATION_TOKEN?.trim());
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

  const token = process.env.GHL_LOCATION_TOKEN!.trim();
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
