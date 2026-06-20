// Modelo (template) do ingresso em PDF. Compartilhado entre o renderizador
// (Fase 1) e o editor (Fase 2). Escopo: padrão por organização + override por
// evento.

export type TicketPreset = "modern" | "classic" | "compact";

export type TicketConfig = {
  preset: TicketPreset;
  brandColor: string; // cor do cabeçalho/realces
  logoUrl: string | null;
  headerTitle: string; // vazio = usa o nome do evento; aceita merge fields
  subtitle: string; // vazio = data · local; aceita merge fields
  instructions: string; // rodapé; aceita merge fields
  showEmail: boolean;
  showPhone: boolean;
  showTime: boolean;
  showLocation: boolean;
};

export const DEFAULT_TICKET_CONFIG: TicketConfig = {
  preset: "modern",
  brandColor: "#2563EB",
  logoUrl: null,
  headerTitle: "",
  subtitle: "",
  instructions: "Apresente este QR Code na entrada do evento.",
  showEmail: false,
  showPhone: false,
  showTime: true,
  showLocation: true,
};

// Normaliza um config vindo do banco (JSON parcial) com os defaults.
export function resolveTicketConfig(
  partial?: Partial<TicketConfig> | null,
): TicketConfig {
  return { ...DEFAULT_TICKET_CONFIG, ...(partial ?? {}) };
}

export type TicketMergeData = {
  event: {
    name: string;
    date: string;
    time?: string | null;
    location?: string | null;
  };
  contact: {
    name: string;
    email?: string | null;
    phone?: string | null;
  };
};

// Substitui {{event.x}} / {{contact.x}} no texto do modelo.
export function mergeFields(text: string, data: TicketMergeData): string {
  return text.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_m, key: string) => {
    const map: Record<string, string | null | undefined> = {
      "event.name": data.event.name,
      "event.date": data.event.date,
      "event.time": data.event.time,
      "event.location": data.event.location,
      "contact.name": data.contact.name,
      "contact.email": data.contact.email,
      "contact.phone": data.contact.phone,
    };
    const v = map[key];
    return v != null ? String(v) : "";
  });
}
