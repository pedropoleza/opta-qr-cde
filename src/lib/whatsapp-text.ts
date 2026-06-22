// Mensagem (caption) que acompanha o PDF anexado no WhatsApp via Stevo.
// O Stevo envia documento + legenda numa única chamada (POST /send/media),
// então este texto é a "mensagem" que o convidado lê junto do ingresso.
export function ticketWhatsappText(p: {
  guestName: string;
  eventName: string;
  eventDate: string;
  eventTime?: string | null;
  eventLocation?: string | null;
  ticketUrl?: string | null;
  brandName?: string | null;
  vip?: boolean;
}): string {
  const brand = p.brandName?.trim() || "Opta Finance";
  const firstName = (p.guestName || "").trim().split(/\s+/)[0] || "Olá";
  const when = [p.eventDate, p.eventTime].filter(Boolean).join(" às ");

  const lines: string[] = [];
  lines.push(`Olá, ${firstName}! 🎟️`);
  lines.push("");
  if (p.vip) {
    lines.push(`Seu ingresso *VIP* para *${p.eventName}* está confirmado. ⭐`);
  } else {
    lines.push(`Seu ingresso para *${p.eventName}* está confirmado.`);
  }
  lines.push("Anexamos o PDF com seu QR Code — apresente na entrada do evento.");
  lines.push("");
  if (when) lines.push(`📅 ${when}`);
  if (p.eventLocation) lines.push(`📍 ${p.eventLocation}`);
  if (p.ticketUrl) {
    lines.push("");
    lines.push(`Ver ingresso online: ${p.ticketUrl}`);
  }
  lines.push("");
  lines.push(`— ${brand}`);
  return lines.join("\n");
}
