import { ticketPublicQrUrl } from "@/lib/ticket";

// Renderização de mensagens no-code (F2). Variáveis no formato {{chave}}.

export const TEMPLATE_VARIABLES: { key: string; label: string }[] = [
  { key: "nome", label: "Nome do convidado" },
  { key: "evento", label: "Nome do evento" },
  { key: "data", label: "Data do evento" },
  { key: "hora", label: "Horário" },
  { key: "local", label: "Local" },
  { key: "endereco", label: "Endereço" },
  { key: "valor", label: "Valor pago" },
  { key: "link_qr", label: "Link do ingresso/QR" },
];

export type TemplateContext = {
  nome?: string | null;
  evento?: string | null;
  data?: string | null;
  hora?: string | null;
  local?: string | null;
  endereco?: string | null;
  valor?: string | null;
  link_qr?: string | null;
};

export function renderTemplate(tpl: string, ctx: TemplateContext): string {
  return tpl.replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (_m, key: string) => {
    const v = (ctx as Record<string, unknown>)[key.toLowerCase()];
    return v == null ? "" : String(v);
  });
}

// Monta o contexto a partir do evento/convidado/ticket.
export function buildContext(args: {
  guestName: string;
  eventName: string;
  eventDate: string;
  startTime?: string | null;
  locationName?: string | null;
  address?: string | null;
  amountPaid?: number | null;
  currency?: string | null;
  token?: string | null;
}): TemplateContext {
  const valor =
    args.amountPaid != null
      ? new Intl.NumberFormat("pt-BR", {
          style: "currency",
          currency: args.currency || "BRL",
        }).format(args.amountPaid / 100)
      : null;
  return {
    nome: args.guestName,
    evento: args.eventName,
    data: args.eventDate,
    hora: args.startTime ?? null,
    local: args.locationName ?? null,
    endereco: args.address ?? null,
    valor,
    link_qr: args.token ? ticketPublicQrUrl(args.token) : null,
  };
}

// Converte texto simples (com quebras de linha) em HTML básico para e-mail.
export function textToHtml(text: string): string {
  const esc = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return esc.replace(/\n/g, "<br/>");
}
