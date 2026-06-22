// Cliente do WhatsApp Business Platform (Meta Cloud API) — envio OFICIAL.
// Diferente do Stevo (não-oficial), aqui o PDF chega como DOCUMENTO ANEXADO:
//   - fora da janela de 24h (iniciado pela empresa): exige template aprovado
//     com header do tipo DOCUMENT, e o PDF entra como parâmetro do header.
//   - dentro da janela de 24h (cliente respondeu): documento livre, sem template.
//
// Configurado por env:
//   WHATSAPP_PHONE_NUMBER_ID  — ID do número no Graph API
//   WHATSAPP_TOKEN            — token de acesso (permanente, do system user)
//   WHATSAPP_TEMPLATE_NAME    — nome do template aprovado (header DOCUMENT)
//   WHATSAPP_TEMPLATE_LANG    — idioma do template (default "pt_BR")
//   WHATSAPP_API_VERSION      — versão do Graph (default "v21.0")
import { cleanEnv } from "@/lib/ghl";

export class WhatsappError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = "WhatsappError";
    this.status = status;
  }
}

function cfg() {
  return {
    phoneId: cleanEnv(process.env.WHATSAPP_PHONE_NUMBER_ID),
    token: cleanEnv(process.env.WHATSAPP_TOKEN),
    template: cleanEnv(process.env.WHATSAPP_TEMPLATE_NAME),
    lang: cleanEnv(process.env.WHATSAPP_TEMPLATE_LANG) || "pt_BR",
    version: cleanEnv(process.env.WHATSAPP_API_VERSION) || "v21.0",
  };
}

// Credenciais presentes (consegue enviar pelo menos documento livre na janela 24h).
export function whatsappCloudConfigured(): boolean {
  const c = cfg();
  return Boolean(c.phoneId && c.token);
}

// Template aprovado configurado (consegue enviar proativo, fora das 24h).
export function whatsappTemplateConfigured(): boolean {
  return whatsappCloudConfigured() && Boolean(cfg().template);
}

async function postMessage(body: Record<string, unknown>): Promise<void> {
  const c = cfg();
  if (!c.phoneId || !c.token) throw new WhatsappError("WhatsApp Cloud não configurado");

  const res = await fetch(
    `https://graph.facebook.com/${c.version}/${c.phoneId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${c.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ messaging_product: "whatsapp", ...body }),
    },
  );
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new WhatsappError(
      `WhatsApp Cloud ${res.status} ${text.slice(0, 300)}`.trim(),
      res.status,
    );
  }
}

// Envio PROATIVO (fora das 24h): template com header DOCUMENT.
// O PDF (link público único por convidado) chega como documento anexado.
// `bodyParams` preenche, em ordem, as variáveis {{1}}, {{2}}… do corpo.
export async function sendWhatsappTemplateDocument({
  to,
  pdfUrl,
  filename,
  bodyParams = [],
}: {
  to: string;
  pdfUrl: string;
  filename: string;
  bodyParams?: string[];
}): Promise<void> {
  const c = cfg();
  if (!c.template) throw new WhatsappError("WHATSAPP_TEMPLATE_NAME não definido");

  const components: Record<string, unknown>[] = [
    {
      type: "header",
      parameters: [
        { type: "document", document: { link: pdfUrl, filename } },
      ],
    },
  ];
  if (bodyParams.length > 0) {
    components.push({
      type: "body",
      parameters: bodyParams.map((text) => ({ type: "text", text })),
    });
  }

  await postMessage({
    to,
    type: "template",
    template: {
      name: c.template,
      language: { code: c.lang },
      components,
    },
  });
}

// Envio LIVRE (somente dentro da janela de 24h): documento anexado direto,
// sem template. Útil para respostas/segundo envio quando o cliente já escreveu.
export async function sendWhatsappDocument({
  to,
  pdfUrl,
  filename,
  caption,
}: {
  to: string;
  pdfUrl: string;
  filename: string;
  caption?: string;
}): Promise<void> {
  await postMessage({
    to,
    type: "document",
    document: {
      link: pdfUrl,
      filename,
      ...(caption ? { caption } : {}),
    },
  });
}
