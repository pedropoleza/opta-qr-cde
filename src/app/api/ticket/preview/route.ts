import { NextRequest, NextResponse } from "next/server";
import QRCode from "qrcode";
import { renderTicketPdf } from "@/lib/ticket-pdf";
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

  const qrDataUrl = await QRCode.toDataURL(
    "https://spark-qrcode-checker.vercel.app/checkin/validate?token=exemplo&sig=exemplo",
    { width: 512, margin: 1, errorCorrectionLevel: "M" },
  );

  const pdf = await renderTicketPdf(
    { ...SAMPLE, qrDataUrl, ticketUrl: "https://spark-qrcode-checker.vercel.app/q/exemplo" },
    config,
  );

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Cache-Control": "no-store",
      "Content-Disposition": 'inline; filename="previa-ingresso.pdf"',
    },
  });
}
