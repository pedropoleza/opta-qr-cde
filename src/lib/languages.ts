// Idiomas suportados na mensagem do WhatsApp. O `code` segue o padrão de idioma
// do WhatsApp (compatível com WHATSAPP_TEMPLATE_LANG do envio oficial).
export type WhatsappLanguage = { code: string; label: string; flag: string };

export const WHATSAPP_LANGUAGES: WhatsappLanguage[] = [
  { code: "pt_BR", label: "Português (BR)", flag: "🇧🇷" },
  { code: "en_US", label: "English (US)", flag: "🇺🇸" },
  { code: "es_ES", label: "Español", flag: "🇪🇸" },
];

export const DEFAULT_LANGUAGE = "pt_BR";

export function languageLabel(code?: string | null): string {
  const l = WHATSAPP_LANGUAGES.find((x) => x.code === code);
  return l ? `${l.flag} ${l.label}` : (code ?? DEFAULT_LANGUAGE);
}

// Estrutura salva em Event.whatsappMessages.
export type WhatsappMessages = {
  default: string; // idioma padrão do evento
  langs: Record<string, string>; // code -> texto (variáveis {{nome}}, {{evento}}…)
};

// Mensagem genérica padrão por idioma — ponto de partida editável pelo usuário.
export const DEFAULT_WHATSAPP_MESSAGES: WhatsappMessages = {
  default: "pt_BR",
  langs: {
    pt_BR:
      "Olá, {{nome}}! 🎟️\n\nSeu ingresso para *{{evento}}* está confirmado.\nO PDF com seu QR Code está anexado — apresente na entrada.\n\n📅 {{data}}\n📍 {{local}}\n\nVer ingresso: {{link_qr}}",
    en_US:
      "Hi {{nome}}! 🎟️\n\nYour ticket for *{{evento}}* is confirmed.\nThe PDF with your QR Code is attached — show it at the entrance.\n\n📅 {{data}}\n📍 {{local}}\n\nView ticket: {{link_qr}}",
    es_ES:
      "¡Hola, {{nome}}! 🎟️\n\nTu entrada para *{{evento}}* está confirmada.\nEl PDF con tu código QR está adjunto — preséntalo en la entrada.\n\n📅 {{data}}\n📍 {{local}}\n\nVer entrada: {{link_qr}}",
  },
};

// Normaliza/valida o objeto vindo do cliente, mantendo só idiomas conhecidos.
export function normalizeWhatsappMessages(input: unknown): WhatsappMessages {
  const obj = (input ?? {}) as Partial<WhatsappMessages>;
  const langs: Record<string, string> = {};
  const src = (obj.langs ?? {}) as Record<string, unknown>;
  for (const { code } of WHATSAPP_LANGUAGES) {
    if (typeof src[code] === "string") langs[code] = String(src[code]);
  }
  const def =
    typeof obj.default === "string" &&
    WHATSAPP_LANGUAGES.some((l) => l.code === obj.default)
      ? obj.default
      : DEFAULT_LANGUAGE;
  return { default: def, langs };
}

// Escolhe o texto para um idioma, com queda para o padrão do evento.
export function pickWhatsappMessage(
  messages: WhatsappMessages | null | undefined,
  language?: string | null,
): string | null {
  if (!messages?.langs) return null;
  const lang = language || messages.default || DEFAULT_LANGUAGE;
  return messages.langs[lang] || messages.langs[messages.default] || null;
}
