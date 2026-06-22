import type { Prisma } from "@prisma/client";
import { enqueueSendQr } from "@/lib/ghl-sync";
import { ghlCanMessage } from "@/lib/ghl";
import {
  ticketPublicQrUrl,
  ticketQrImageUrl,
  ticketPdfUrl,
} from "@/lib/ticket";
import { normalizePhone } from "@/lib/stevo";
import { whatsappTemplateConfigured } from "@/lib/whatsapp-cloud";
import { ticketWhatsappText } from "@/lib/whatsapp-text";
import { emailConfigured, ticketEmailHtml } from "@/lib/email";

type Tx = Prisma.TransactionClient;

export type DeliveryGuest = {
  id: string;
  eventId: string;
  name: string;
  email: string | null;
  phone: string | null;
  ghlContactId: string | null;
  ticketId: string;
  token: string;
  vip?: boolean;
};

export type DeliveryEvent = {
  id: string;
  name: string;
  slug: string;
  date: string; // YYYY-MM-DD
  location: string;
  time?: string | null;
  organizationId?: string | null;
};

// Identidade visual do tenant para o e-mail (cor, marca, logo).
export type EmailBranding = {
  brandColor?: string | null;
  brandName?: string | null;
  logoUrl?: string | null;
};

export async function resolveEmailBranding(
  tx: Tx,
  organizationId?: string | null,
): Promise<EmailBranding> {
  if (!organizationId) return {};
  const org = await tx.organization.findUnique({
    where: { id: organizationId },
    select: { brandName: true, primaryColor: true, logoUrl: true },
  });
  return {
    brandColor: org?.primaryColor ?? null,
    brandName: org?.brandName ?? null,
    logoUrl: org?.logoUrl ?? null,
  };
}

// Enfileira a entrega do QR pelo canal escolhido, com fallback sensato:
//  - ghl: grava campos no contato + tag-gatilho (workflow do GHL envia). Se não
//    houver contato GHL, cai para e-mail direto quando possível.
//  - whatsapp: envia o PDF pelo Stevo (worker).
//  - email: envio direto (Resend) quando configurado, senão tag-gatilho do GHL.
export type DeliveryOverrides = {
  caption?: string; // WhatsApp
  emailSubject?: string;
  emailHtml?: string;
};

export async function enqueueQrDelivery(
  tx: Tx,
  event: DeliveryEvent,
  guest: DeliveryGuest,
  channel: string,
  opts?: DeliveryOverrides,
): Promise<{ queued: boolean; via: string }> {
  const token = guest.token;

  // E-mail profissional com identidade do tenant. Construtor único (DRY): só
  // mudam o QR e as variáveis; o desenho é o mesmo em todos os caminhos.
  let branding: EmailBranding | null = null;
  const buildHtml = async () => {
    if (!branding) branding = await resolveEmailBranding(tx, event.organizationId);
    return ticketEmailHtml({
      eventName: event.name,
      eventDate: event.date,
      eventTime: event.time,
      eventLocation: event.location,
      guestName: guest.name,
      qrImageUrl: ticketQrImageUrl(token),
      ticketUrl: ticketPublicQrUrl(token),
      pdfUrl: ticketPdfUrl(token),
      vip: guest.vip,
      brandColor: branding.brandColor,
      brandName: branding.brandName,
      logoUrl: branding.logoUrl,
    });
  };

  if (channel === "whatsapp" && guest.phone) {
    // WhatsApp OFICIAL (Meta Cloud) quando há template aprovado: o PDF chega
    // como documento anexado. Senão, cai no Stevo (não-oficial), que envia o
    // PDF anexado (POST /send/media, type document) + a legenda profissional.
    const official = whatsappTemplateConfigured();
    if (!branding) branding = await resolveEmailBranding(tx, event.organizationId);
    const caption =
      opts?.caption ??
      ticketWhatsappText({
        guestName: guest.name,
        eventName: event.name,
        eventDate: event.date,
        eventTime: event.time,
        eventLocation: event.location,
        ticketUrl: ticketPublicQrUrl(token),
        brandName: branding.brandName,
        vip: guest.vip,
      });
    await tx.ghlSyncJob.create({
      data: {
        eventId: event.id,
        guestId: guest.id,
        ghlContactId: guest.ghlContactId,
        action: official ? "whatsapp_cloud" : "send_whatsapp",
        payload: {
          to: normalizePhone(guest.phone),
          url: ticketPdfUrl(token),
          filename: `ingresso-${event.slug}.pdf`,
          ...(official
            ? { bodyParams: [guest.name, event.name, event.date] }
            : { caption }),
        },
      },
    });
    await logQueued(tx, event.id, guest, official ? "whatsapp-cloud" : "stevo-whatsapp");
    return { queued: true, via: official ? "whatsapp-cloud" : "whatsapp" };
  }

  if (channel === "email" && emailConfigured() && guest.email) {
    const html = opts?.emailHtml ?? (await buildHtml());
    await tx.ghlSyncJob.create({
      data: {
        eventId: event.id,
        guestId: guest.id,
        action: "send_email",
        payload: {
          to: guest.email,
          subject: opts?.emailSubject ?? `Seu ingresso — ${event.name}`,
          html,
        },
      },
    });
    await logQueued(tx, event.id, guest, "resend");
    return { queued: true, via: "email" };
  }

  // Canal GHL: envio DIRETO pela API de Conversations quando a conexão é OAuth
  // (escopo de mensagens). Senão, cai no modelo tag-gatilho + workflow.
  if (
    guest.ghlContactId &&
    event.organizationId &&
    (await ghlCanMessage(event.organizationId))
  ) {
    await tx.ghlSyncJob.create({
      data: {
        eventId: event.id,
        guestId: guest.id,
        ghlContactId: guest.ghlContactId,
        action: "ghl_message",
        payload: {
          type: "Email",
          subject: opts?.emailSubject ?? `Seu ingresso — ${event.name}`,
          html: opts?.emailHtml ?? (await buildHtml()),
          attachments: [ticketPdfUrl(token)],
        },
      },
    });
    await logQueued(tx, event.id, guest, "ghl");
    return { queued: true, via: "ghl-conversations" };
  }

  // Canal GHL (fallback): tag-gatilho + campos no contato.
  if (guest.ghlContactId) {
    await enqueueSendQr(
      tx,
      { id: guest.id, eventId: event.id, ghlContactId: guest.ghlContactId },
      event.slug,
      {
        eventName: event.name,
        eventDate: event.date,
        eventLocation: event.location,
        qrLink: ticketPublicQrUrl(token),
        qrImageUrl: ticketQrImageUrl(token),
        guestName: guest.name,
        pdfUrl: ticketPdfUrl(token),
      },
    );
    await logQueued(tx, event.id, guest, "ghl");
    return { queued: true, via: "ghl" };
  }

  // Sem contato GHL: tenta e-mail direto como último recurso.
  if (emailConfigured() && guest.email) {
    const html = await buildHtml();
    await tx.ghlSyncJob.create({
      data: {
        eventId: event.id,
        guestId: guest.id,
        action: "send_email",
        payload: { to: guest.email, subject: `Seu ingresso — ${event.name}`, html },
      },
    });
    await logQueued(tx, event.id, guest, "resend");
    return { queued: true, via: "email-fallback" };
  }

  return { queued: false, via: "none" };
}

// Mensagem avulsa (sem QR), ex.: confirmação de inscrição. Canais texto.
export async function enqueueMessage(
  tx: Tx,
  guest: { id: string; eventId: string; email: string | null; phone: string | null },
  channel: string,
  msg: { subject?: string; body: string; html: string },
): Promise<{ queued: boolean; via: string }> {
  if (channel === "whatsapp" && guest.phone) {
    await tx.ghlSyncJob.create({
      data: {
        eventId: guest.eventId,
        guestId: guest.id,
        action: "send_whatsapp_text",
        payload: { to: normalizePhone(guest.phone), text: msg.body },
      },
    });
    return { queued: true, via: "whatsapp" };
  }
  if (channel === "email" && emailConfigured() && guest.email) {
    await tx.ghlSyncJob.create({
      data: {
        eventId: guest.eventId,
        guestId: guest.id,
        action: "send_email",
        payload: { to: guest.email, subject: msg.subject ?? "Confirmação", html: msg.html },
      },
    });
    return { queued: true, via: "email" };
  }
  return { queued: false, via: "none" };
}

async function logQueued(
  tx: Tx,
  eventId: string,
  guest: DeliveryGuest,
  provider: string,
) {
  await tx.emailLog.create({
    data: {
      eventId,
      guestId: guest.id,
      ticketId: guest.ticketId,
      provider,
      status: "queued",
    },
  });
}
