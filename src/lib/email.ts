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

// Template do e-mail do ingresso (imagem do QR + botão + link do PDF).
export function ticketEmailHtml(p: {
  eventName: string;
  eventDate: string;
  eventLocation: string;
  guestName: string;
  qrImageUrl: string;
  ticketUrl: string;
  pdfUrl: string;
}): string {
  return `<!doctype html><html><body style="margin:0;background:#f7f8fa;padding:24px;font-family:Inter,Arial,sans-serif;color:#101828">
  <div style="max-width:480px;margin:auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #eaecf0">
    <div style="background:#2563eb;color:#fff;padding:24px;text-align:center">
      <div style="font-size:12px;letter-spacing:2px;text-transform:uppercase;opacity:.85">Spark Check-in · Ingresso</div>
      <h1 style="margin:6px 0 0;font-size:20px">${p.eventName}</h1>
      <div style="margin-top:6px;font-size:13px;opacity:.9">${p.eventDate}${p.eventLocation ? " · " + p.eventLocation : ""}</div>
    </div>
    <div style="padding:24px;text-align:center">
      <p style="margin:0 0 4px;font-size:15px">Olá ${p.guestName},</p>
      <p style="margin:0 0 16px;color:#667085;font-size:14px">aqui está o seu ingresso. Apresente o QR Code na entrada.</p>
      <img src="${p.qrImageUrl}" alt="QR Code" width="220" height="220" style="border-radius:12px;border:1px solid #eaecf0" />
      <div style="margin-top:20px">
        <a href="${p.ticketUrl}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:600">Ver meu ingresso</a>
      </div>
      <div style="margin-top:12px">
        <a href="${p.pdfUrl}" style="color:#667085;font-size:13px">Baixar ingresso em PDF</a>
      </div>
    </div>
  </div>
</body></html>`;
}
