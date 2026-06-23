import { NextRequest, NextResponse } from "next/server";
import QRCode from "qrcode";
import { renderTicketPdf } from "@/lib/ticket-pdf";
import { renderBadgePdf } from "@/lib/badge-pdf";
import { sparkLogoUrl } from "@/lib/ticket";
import { resolveTicketConfig } from "@/lib/ticket-template";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Pré-visualização do modelo do ingresso com dados de EXEMPLO. Recebe o config
// (ainda não salvo) e devolve o PDF — usado pelo editor ao vivo.
const SAMPLE = {
  event: {
    name: "Festa Spark 2026",
    date: "2026-07-15",
    time: "19:00",
    location: "Opta HQ · Framingham, MA",
  },
  contact: {
    name: "Maria Convidada",
    email: "maria@exemplo.com",
    phone: "+1 (508) 904-0317",
  },
};

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const config = resolveTicketConfig(body.config ?? null);
  const kind = body.kind === "badge" ? "badge" : "ticket";
  const vip = Boolean(body.vip);

  const qrDataUrl = await QRCode.toDataURL(
    "https://eventos.optafinance.com/checkin/validate?token=exemplo&sig=exemplo",
    { width: 512, margin: kind === "badge" ? 0 : 1, errorCorrectionLevel: "M" },
  );

  const pdf =
    kind === "badge"
      ? await renderBadgePdf({
          guestName: SAMPLE.contact.name,
          eventName: SAMPLE.event.name,
          eventDate: SAMPLE.event.date,
          tier: vip ? null : "Geral",
          vip,
          qrDataUrl,
          brandColor: config.brandColor,
          logoUrl: config.logoUrl,
          effect: config.headerEffect,
          sparkLogoUrl: sparkLogoUrl(),
        })
      : await renderTicketPdf(
          {
            ...SAMPLE,
            qrDataUrl,
            ticketUrl: "https://eventos.optafinance.com/q/exemplo",
            vip,
          },
          config,
        );

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Cache-Control": "no-store",
      "Content-Disposition": 'inline; filename="previa.pdf"',
    },
  });
}
