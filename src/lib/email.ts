import { cleanEnv } from "@/lib/ghl";

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

// Template PROFISSIONAL e fixo do e-mail do ingresso (tabelas + estilos inline,
// compatível com Outlook/Gmail). Só mudam o QR e as variáveis.
export function ticketEmailHtml(p: {
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
}): string {
  const brand = p.brandColor || "#0EA5E9";
  const brandName = esc(p.brandName || "Spark Check-in");
  const when = [esc(p.eventDate), p.eventTime ? esc(p.eventTime) : ""]
    .filter(Boolean)
    .join(" · ");

  const row = (label: string, value: string) =>
    value
      ? `<tr>
          <td style="padding:6px 0;color:#94a3b8;font-size:13px;width:90px;vertical-align:top">${label}</td>
          <td style="padding:6px 0;color:#1e293b;font-size:14px;font-weight:600">${value}</td>
        </tr>`
      : "";

  return `<!doctype html>
<html lang="pt-BR">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="x-apple-disable-message-reformatting"><title>${esc(p.eventName)}</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
        <!-- Header -->
        <tr><td style="background:${brand};padding:22px 28px;">
          <table role="presentation" width="100%"><tr>
            <td style="color:#ffffff;font-size:16px;font-weight:700;letter-spacing:.3px;">${brandName}</td>
            <td align="right" style="color:#ffffff;opacity:.85;font-size:11px;letter-spacing:2px;text-transform:uppercase;">Ingresso</td>
          </tr></table>
        </td></tr>

        <!-- Título -->
        <tr><td style="padding:28px 28px 8px;">
          <h1 style="margin:0;font-size:22px;line-height:1.25;color:#0f172a;">${esc(p.eventName)}</h1>
          <p style="margin:14px 0 0;color:#475569;font-size:15px;">Olá <strong>${esc(p.guestName)}</strong>, seu ingresso está confirmado. Apresente o QR Code abaixo na entrada.</p>
        </td></tr>

        <!-- QR -->
        <tr><td align="center" style="padding:18px 28px 6px;">
          <table role="presentation" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0;border-radius:16px;background:#ffffff;">
            <tr><td style="padding:16px;">
              <img src="${p.qrImageUrl}" alt="QR Code do ingresso" width="220" height="220" style="display:block;width:220px;height:220px;">
            </td></tr>
          </table>
        </td></tr>

        <!-- Detalhes -->
        <tr><td style="padding:14px 28px 4px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #eef2f6;">
            <tr><td style="height:8px"></td></tr>
            ${row("Data", when)}
            ${row("Local", esc(p.eventLocation))}
          </table>
        </td></tr>

        <!-- CTA -->
        <tr><td align="center" style="padding:22px 28px 8px;">
          <table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="border-radius:10px;background:${brand};">
            <a href="${p.ticketUrl}" style="display:inline-block;padding:13px 28px;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;border-radius:10px;">Ver meu ingresso</a>
          </td></tr></table>
          <p style="margin:12px 0 0;"><a href="${p.pdfUrl}" style="color:#64748b;font-size:13px;text-decoration:underline;">Baixar ingresso em PDF</a></p>
        </td></tr>

        <!-- Footer -->
        <tr><td style="padding:20px 28px 26px;border-top:1px solid #eef2f6;">
          <p style="margin:0;color:#94a3b8;font-size:12px;text-align:center;">
            Este e-mail foi enviado por ${brandName}. Guarde-o para apresentar na entrada do evento.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}
