import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { prisma } from "@/lib/prisma";
import { ticketValidationUrl } from "@/lib/ticket";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

// Página pública do QR do convidado (D2): o e-mail leva a esta página em vez
// de embutir a imagem — mais confiável que imagem embedada via GHL.
export default async function GuestQrPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const ticket = await prisma.ticket.findUnique({
    where: { token },
    include: {
      guest: { select: { name: true, status: true } },
      event: {
        select: { name: true, date: true, startTime: true, locationName: true, address: true },
      },
    },
  });
  if (!ticket || ticket.status === "canceled") notFound();

  const dataUrl = await QRCode.toDataURL(
    ticketValidationUrl(ticket.token, ticket.signature),
    { width: 512, margin: 2, errorCorrectionLevel: "M" }
  );

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-neutral-50 p-6">
      <div className="w-full max-w-sm rounded-xl border bg-white p-6 text-center shadow-sm">
        <p className="text-sm uppercase tracking-wide text-neutral-500">
          Seu ingresso
        </p>
        <h1 className="mt-1 text-xl font-bold">{ticket.event.name}</h1>
        <p className="text-sm text-neutral-500">
          {ticket.event.date.toISOString().slice(0, 10)}
          {ticket.event.startTime ? ` · ${ticket.event.startTime}` : ""}
        </p>
        {ticket.event.locationName && (
          <p className="text-sm text-neutral-500">{ticket.event.locationName}</p>
        )}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={dataUrl} alt="QR Code de check-in" className="mx-auto my-4 w-64" />
        <p className="font-semibold">{ticket.guest.name}</p>
        {ticket.status === "checked_in" ? (
          <p className="mt-2 rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">
            Check-in já realizado
            {ticket.checkedInAt
              ? ` às ${ticket.checkedInAt.toLocaleTimeString("pt-BR")}`
              : ""}
          </p>
        ) : (
          <p className="mt-2 text-sm text-neutral-500">
            Apresente este QR Code na entrada do evento.
          </p>
        )}
        <Button asChild variant="outline" className="mt-4 w-full">
          <a href={`/api/qr/${ticket.token}`} download="meu-qr-code.png">
            Baixar QR Code (PNG)
          </a>
        </Button>
      </div>
    </div>
  );
}
