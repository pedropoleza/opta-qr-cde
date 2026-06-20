import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { prisma } from "@/lib/prisma";
import { ticketValidationUrl } from "@/lib/ticket";
import { Button } from "@/components/ui/button";
import { RsvpButtons } from "@/components/ticket/rsvp-buttons";

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
      guest: { select: { name: true, status: true, rsvp: true } },
      event: {
        select: {
          name: true,
          date: true,
          startTime: true,
          endTime: true,
          locationName: true,
          address: true,
        },
      },
    },
  });
  if (!ticket || ticket.status === "canceled") notFound();

  const dataUrl = await QRCode.toDataURL(
    ticketValidationUrl(ticket.token, ticket.signature),
    { width: 512, margin: 1, errorCorrectionLevel: "M" }
  );

  const checkedIn = ticket.status === "checked_in";
  const dateLabel = ticket.event.date.toISOString().slice(0, 10);
  const timeLabel = [ticket.event.startTime, ticket.event.endTime]
    .filter(Boolean)
    .join(" – ");

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-900 p-4">
      <div className="w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-xl">
        {/* Cabeçalho do ingresso */}
        <div className="bg-neutral-900 px-6 py-5 text-center text-white">
          <p className="text-xs uppercase tracking-[0.2em] text-neutral-400">
            Spark Check-in · Ingresso
          </p>
          <h1 className="mt-1 text-xl font-bold">{ticket.event.name}</h1>
          <p className="mt-1 text-sm text-neutral-300">
            {dateLabel}
            {timeLabel ? ` · ${timeLabel}` : ""}
          </p>
          {ticket.event.locationName && (
            <p className="text-sm text-neutral-300">{ticket.event.locationName}</p>
          )}
          {ticket.event.address && (
            <p className="text-xs text-neutral-400">{ticket.event.address}</p>
          )}
        </div>

        {/* Recorte perfurado */}
        <div className="relative h-4 bg-neutral-900">
          <div className="absolute -left-2 top-1/2 h-4 w-4 -translate-y-1/2 rounded-full bg-neutral-900" />
          <div className="absolute inset-x-3 top-1/2 -translate-y-1/2 border-t border-dashed border-neutral-700" />
          <div className="absolute -right-2 top-1/2 h-4 w-4 -translate-y-1/2 rounded-full bg-neutral-900" />
        </div>

        {/* Corpo com o QR */}
        <div className="px-6 py-6 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={dataUrl}
            alt="QR Code de check-in"
            className="mx-auto w-60 rounded-lg"
          />
          <p className="mt-4 text-lg font-semibold">{ticket.guest.name}</p>

          {checkedIn ? (
            <p className="mt-3 rounded-md bg-green-50 px-3 py-2 text-sm font-medium text-green-700">
              ✓ Check-in realizado
              {ticket.checkedInAt
                ? ` às ${ticket.checkedInAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`
                : ""}
            </p>
          ) : (
            <p className="mt-3 text-sm text-neutral-500">
              Apresente este QR Code na entrada do evento.
            </p>
          )}

          {!checkedIn && (
            <RsvpButtons token={ticket.token} initial={ticket.guest.rsvp} />
          )}

          <Button asChild variant="outline" className="mt-5 w-full">
            <a href={`/api/qr/${ticket.token}`} download="meu-qr-code.png">
              Baixar QR Code (PNG)
            </a>
          </Button>
        </div>
      </div>
    </div>
  );
}
