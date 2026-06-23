import { NextRequest, NextResponse } from "next/server";
import QRCode from "qrcode";
import { prisma } from "@/lib/prisma";
import { ticketValidationUrl } from "@/lib/ticket";

// PNG do QR Code do ticket. O token é o próprio segredo do convidado, então a
// rota é pública por design (mesmo modelo do link recebido por e-mail — D2).
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const ticket = await prisma.ticket.findUnique({
    where: { token },
    select: { token: true, signature: true, status: true },
  });
  if (!ticket) return new NextResponse("Not found", { status: 404 });

  const png = await QRCode.toBuffer(ticketValidationUrl(ticket.token, ticket.signature), {
    type: "png",
    width: 512,
    margin: 2,
    errorCorrectionLevel: "M",
  });

  return new NextResponse(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      // O QR embute a URL de validação ({APP_BASE_URL}/checkin/validate). Cache
      // moderado para que uma troca de domínio/base propague rápido (sem janela
      // longa de "stale" servindo o domínio antigo).
      "Cache-Control": "public, max-age=300, s-maxage=3600, stale-while-revalidate=3600",
      "Content-Disposition": `inline; filename="qr-${token.slice(0, 8)}.png"`,
    },
  });
}
