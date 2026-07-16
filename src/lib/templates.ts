import { ticketPublicQrUrl, ticketCertificateUrl, npsUrl } from "@/lib/ticket";

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
  { key: "link_certificado", label: "Link do certificado" },
  { key: "link_nps", label: "Link da pesquisa/NPS" },
];

export type TemplateContext = {
  nome?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  phone?: string | null;
  evento?: string | null;
  data?: string | null;
  hora?: string | null;
  local?: string | null;
  endereco?: string | null;
  valor?: string | null;
  link_qr?: string | null;
  link_certificado?: string | null;
  link_nps?: string | null;
};

// Apelidos: aceita tanto as variáveis próprias ({{nome}}) quanto as do estilo
// GHL ({{contact.first_name}}), já que o editor de mensagens oferece as do GHL,
// mas o envio por WhatsApp/e-mail é renderizado aqui (o GHL não substitui).
const KEY_ALIASES: Record<string, string> = {
  first_name: "first_name",
  firstname: "first_name",
  primeiro_nome: "first_name",
  last_name: "last_name",
  lastname: "last_name",
  sobrenome: "last_name",
  full_name: "nome",
  fullname: "nome",
  name: "nome",
  nome_completo: "nome",
  email: "email",
  phone: "phone",
  telefone: "phone",
  event_name: "evento",
  event_date: "data",
  event_time: "hora",
  event_location: "local",
  event_address: "endereco",
};

export function renderTemplate(tpl: string, ctx: TemplateContext): string {
  return tpl.replace(/\{\{\s*([a-z0-9_.]+)\s*\}\}/gi, (_m, rawKey: string) => {
    let key = rawKey.toLowerCase();
    // Remove prefixos comuns do GHL: contact., custom_values., event., etc.
    key = key.replace(/^(contact|custom_values|event|user|appointment|account)\./, "");
    key = KEY_ALIASES[key] ?? key;
    const v = (ctx as Record<string, unknown>)[key];
    return v == null ? "" : String(v);
  });
}

// Monta o contexto a partir do evento/convidado/ticket.
export function buildContext(args: {
  guestName: string;
  guestEmail?: string | null;
  guestPhone?: string | null;
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
  const parts = (args.guestName ?? "").trim().split(/\s+/).filter(Boolean);
  const firstName = parts[0] ?? null;
  const lastName = parts.length > 1 ? parts.slice(1).join(" ") : null;
  return {
    nome: args.guestName,
    first_name: firstName,
    last_name: lastName,
    email: args.guestEmail ?? null,
    phone: args.guestPhone ?? null,
    evento: args.eventName,
    data: args.eventDate,
    hora: args.startTime ?? null,
    local: args.locationName ?? null,
    endereco: args.address ?? null,
    valor,
    link_qr: args.token ? ticketPublicQrUrl(args.token) : null,
    link_certificado: args.token ? ticketCertificateUrl(args.token) : null,
    link_nps: args.token ? npsUrl(args.token) : null,
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
