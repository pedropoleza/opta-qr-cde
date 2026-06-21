import { cleanEnv } from "@/lib/ghl";
import { readableOn, shade } from "@/lib/color";

// Envio de e-mail direto pelo app (Resend) — alternativa que NÃO depende do
// workflow do GHL. Liga por env: RESEND_API_KEY + EMAIL_FROM.
export function emailConfigured(): boolean {
  return Boolean(
    cleanEnv(process.env.RESEND_API_KEY) && cleanEnv(process.env.EMAIL_FROM),
  );
}

export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}): Promise<void> {
  const key = cleanEnv(process.env.RESEND_API_KEY);
  const from = cleanEnv(process.env.EMAIL_FROM);
  if (!key || !from) throw new Error("E-mail (Resend) não configurado");

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to, subject, html }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Resend ${res.status} ${body.slice(0, 200)}`.trim());
  }
}

function esc(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export type TicketEmailData = {
  eventName: string;
  eventDate: string;
  eventLocation: string;
  guestName: string;
  qrImageUrl: string;
  ticketUrl: string;
  pdfUrl: string;
  eventTime?: string | null;
  brandColor?: string | null;
  brandName?: string | null;
  logoUrl?: string | null;
  vip?: boolean;
};

// Template PROFISSIONAL e fixo do e-mail do ingresso (tabelas + estilos inline,
// compatível com Outlook/Gmail). Identidade por tenant: cor, logo e marca.
// Só mudam o QR e as variáveis — o desenho é sempre o mesmo.
export function ticketEmailHtml(p: TicketEmailData): string {
  const vip = !!p.vip;
  const brand = (p.brandColor || "#0EA5E9").trim();
  const brandName = esc(p.brandName || "Spark Check-in");
  const logoUrl = p.logoUrl?.trim() || null;

  // Hero: VIP usa tema escuro + dourado; senão, gradiente da cor da marca.
  const heroBg = vip ? "#15171C" : brand;
  const heroBg2 = vip ? "#2A2410" : shade(brand, -22);
  const onHero = vip ? "#F5E6B3" : readableOn(brand);
  const onHeroMuted = vip
    ? "rgba(245,230,179,0.72)"
    : onHero === "#FFFFFF"
      ? "rgba(255,255,255,0.78)"
      : "rgba(16,24,40,0.62)";
  const accent = vip ? "#C9A227" : brand;
  const onAccent = vip ? "#1A1407" : readableOn(brand);
  const pillBg = vip ? "rgba(201,162,39,0.18)" : "rgba(255,255,255,0.16)";
  const pillTxt = vip ? "#E9CF73" : onHero;
  const label = vip ? "★ Ingresso VIP" : "Ingresso";

  const when = [esc(p.eventDate), p.eventTime ? esc(p.eventTime) : ""]
    .filter(Boolean)
    .join(" · ");
  const outer = "#eef2f7"; // fundo da página (também a cor dos recortes do ticket)

  const detail = (label: string, value: string) =>
    value
      ? `<tr>
            <td style="padding:9px 0;vertical-align:top;width:34px;">
              <div style="width:8px;height:8px;border-radius:8px;background:${accent};margin-top:6px;"></div>
            </td>
            <td style="padding:9px 0;">
              <div style="color:#94a3b8;font-size:11px;letter-spacing:1.5px;text-transform:uppercase;">${label}</div>
              <div style="color:#0f172a;font-size:15px;font-weight:600;margin-top:2px;">${value}</div>
            </td>
          </tr>`
      : "";

  const brandHead = logoUrl
    ? `<img src="${logoUrl}" alt="${brandName}" height="40" style="display:block;margin:0 auto;max-height:40px;width:auto;">`
    : `<div style="color:${onHero};font-size:18px;font-weight:800;letter-spacing:.4px;text-align:center;">${brandName}</div>`;

  return `<!doctype html>
<html lang="pt-BR">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="x-apple-disable-message-reformatting"><title>${esc(p.eventName)}</title></head>
<body style="margin:0;padding:0;background:${outer};">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">Seu ingresso para ${esc(p.eventName)} — apresente o QR Code na entrada.</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${outer};padding:28px 14px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:20px;overflow:hidden;border:1px solid #e2e8f0;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">

        <!-- HERO -->
        <tr><td style="background:${heroBg};background-image:linear-gradient(135deg,${heroBg} 0%,${heroBg2} 100%);padding:34px 30px 30px;text-align:center;">
          ${brandHead}
          <div style="margin:18px auto 0;display:inline-block;background:${pillBg};color:${pillTxt};font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;padding:6px 14px;border-radius:999px;">${label}</div>
          <h1 style="margin:16px 0 0;font-size:26px;line-height:1.2;color:${onHero};font-weight:800;">${esc(p.eventName)}</h1>
          ${when ? `<p style="margin:8px 0 0;color:${onHeroMuted};font-size:14px;">${when}</p>` : ""}
        </td></tr>

        <!-- Saudação -->
        <tr><td style="padding:28px 32px 4px;">
          <p style="margin:0;color:#334155;font-size:16px;line-height:1.55;">
            Olá <strong style="color:#0f172a;">${esc(p.guestName)}</strong>, seu ingresso está confirmado.
            Apresente o QR Code abaixo na entrada do evento.
          </p>
        </td></tr>

        <!-- QR -->
        <tr><td align="center" style="padding:22px 32px 8px;">
          <table role="presentation" cellpadding="0" cellspacing="0" style="border:1px solid #e6eaf0;border-radius:20px;background:#ffffff;">
            <tr><td style="padding:20px 20px 12px;">
              <img src="${p.qrImageUrl}" alt="QR Code do ingresso" width="230" height="230" style="display:block;width:230px;height:230px;border-radius:8px;">
            </td></tr>
            <tr><td style="padding:0 20px 16px;text-align:center;color:#94a3b8;font-size:12px;letter-spacing:1px;text-transform:uppercase;">Seu ingresso de entrada</td></tr>
          </table>
        </td></tr>

        <!-- Recorte perfurado -->
        <tr><td style="padding:14px 0 2px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
            <td width="14" style="line-height:0;"><div style="width:14px;height:14px;border-radius:14px;background:${outer};"></div></td>
            <td style="border-top:2px dashed #e2e8f0;font-size:0;line-height:0;">&nbsp;</td>
            <td width="14" align="right" style="line-height:0;"><div style="width:14px;height:14px;border-radius:14px;background:${outer};"></div></td>
          </tr></table>
        </td></tr>

        <!-- Detalhes -->
        <tr><td style="padding:8px 32px 4px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            ${detail("Data", when)}
            ${detail("Local", esc(p.eventLocation))}
            ${detail("Convidado", esc(p.guestName))}
          </table>
        </td></tr>

        <!-- CTA -->
        <tr><td align="center" style="padding:24px 32px 6px;">
          <table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="border-radius:12px;background:${accent};">
            <a href="${p.ticketUrl}" style="display:inline-block;padding:15px 34px;color:${onAccent};text-decoration:none;font-weight:700;font-size:15px;border-radius:12px;">Ver meu ingresso online</a>
          </td></tr></table>
          <p style="margin:14px 0 0;"><a href="${p.pdfUrl}" style="color:#64748b;font-size:13px;text-decoration:underline;">Baixar ingresso em PDF</a></p>
        </td></tr>

        <!-- Footer -->
        <tr><td style="padding:24px 32px 28px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="border-top:1px solid #eef2f6;padding-top:18px;">
            <p style="margin:0;color:#94a3b8;font-size:12px;line-height:1.6;text-align:center;">
              Este e-mail foi enviado por <strong style="color:#64748b;">${brandName}</strong>.<br>
              Guarde-o para apresentar na entrada do evento.
            </p>
          </td></tr></table>
        </td></tr>
      </table>

      <p style="margin:16px 0 0;color:#b6c0cf;font-size:11px;letter-spacing:.5px;">feito com Spark</p>
    </td></tr>
  </table>
</body></html>`;
}
