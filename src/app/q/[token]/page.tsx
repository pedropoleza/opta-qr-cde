import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { prisma } from "@/lib/prisma";
import { ticketValidationUrl, isVipGuest } from "@/lib/ticket";
import { getEventTicketConfig } from "@/lib/ticket-config";
import { isLightColor } from "@/lib/color";
import { Button } from "@/components/ui/button";
import { RsvpButtons } from "@/components/ticket/rsvp-buttons";

// Padrões CSS dos efeitos (espelham os do PDF) para a página pública.
function headerEffectStyle(effect: string): React.CSSProperties {
  if (effect === "halftone")
    return {
      backgroundImage: "radial-gradient(rgba(255,255,255,0.35) 1px, transparent 1.4px)",
      backgroundSize: "9px 9px",
    };
  if (effect === "bars")
    return {
      backgroundImage:
        "repeating-linear-gradient(115deg, rgba(255,255,255,0.12) 0 8px, transparent 8px 26px)",
    };
  if (effect === "gradient")
    return { backgroundImage: "linear-gradient(135deg, rgba(255,255,255,0) 30%, rgba(255,255,255,0.25))" };
  if (effect === "waves")
    return {
      backgroundImage:
        "radial-gradient(120% 60% at 50% 120%, rgba(255,255,255,0.22), transparent 60%)",
    };
  return {};
}
function backgroundStyle(bg: string, color: string): React.CSSProperties {
  if (bg === "dots")
    return {
      backgroundImage: `radial-gradient(${color}12 1.3px, transparent 1.3px)`,
      backgroundSize: "20px 20px",
    };
  if (bg === "grid")
    return {
      backgroundImage: `linear-gradient(${color}10 0.6px, transparent 0.6px), linear-gradient(90deg, ${color}10 0.6px, transparent 0.6px)`,
      backgroundSize: "26px 26px",
    };
  if (bg === "gradient")
    return { backgroundImage: `linear-gradient(180deg, ${color}0d, transparent)` };
  return {};
}

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
      guest: { select: { name: true, status: true, rsvp: true, vip: true, tier: true } },
      event: {
        select: {
          name: true,
          date: true,
          startTime: true,
          endTime: true,
          locationName: true,
          address: true,
          organization: {
            select: { name: true, brandName: true, logoUrl: true, primaryColor: true },
          },
        },
      },
    },
  });
  if (!ticket || ticket.status === "canceled") notFound();

  const dataUrl = await QRCode.toDataURL(
    ticketValidationUrl(ticket.token, ticket.signature),
    { width: 512, margin: 1, errorCorrectionLevel: "M" }
  );

  const { config } = await getEventTicketConfig(ticket.eventId);

  const checkedIn = ticket.status === "checked_in";
  const dateLabel = ticket.event.date.toISOString().slice(0, 10);
  const timeLabel = [ticket.event.startTime, ticket.event.endTime]
    .filter(Boolean)
    .join(" – ");

  // White-label por tenant (Fase 5): marca, logo e cor primária da organização.
  const org = ticket.event.organization;
  const brand = org?.brandName?.trim() || "Spark Check-in";
  // Logo do design (herda a da organização por padrão).
  const logoUrl = config.logoUrl || org?.logoUrl || null;
  const vip = isVipGuest(ticket.guest);
  const headerColor = org?.primaryColor?.trim() || null;
  // VIP (#8): arte especial — fundo escuro + halftone dourado.
  const headerStyle: React.CSSProperties | undefined = vip
    ? {
        backgroundColor: "#15171C",
        backgroundImage:
          "radial-gradient(rgba(201,162,39,0.35) 1px, transparent 1.4px)",
        backgroundSize: "10px 10px",
      }
    : {
        ...(headerColor ? { backgroundColor: headerColor } : {}),
        ...headerEffectStyle(config.headerEffect),
      };
  const headerClass = vip || headerColor ? "" : "bg-neutral-900";
  // Contraste automático (F4): texto escuro quando a cor da marca é clara.
  const darkText = !vip && !!headerColor && isLightColor(headerColor);
  const mainText = darkText ? "text-neutral-900" : "text-white";
  const mutedText = darkText ? "text-neutral-700" : "text-neutral-300";
  // Textura do corpo (F2), exceto no VIP (que tem arte própria).
  const bodyBgStyle = vip
    ? undefined
    : backgroundStyle(config.background, headerColor || "#101828");

  return (
    <div className={`flex min-h-screen items-center justify-center p-4 ${vip ? "bg-[#0F1115]" : "bg-neutral-900"}`}>
      <div className="w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-xl">
        {/* Cabeçalho do ingresso */}
        <div
          className={`px-6 py-5 text-center ${mainText} ${headerClass}`}
          style={headerStyle}
        >
          {vip && (
            <span className="mb-2 inline-block rounded-full bg-[#C9A227] px-3 py-0.5 text-xs font-bold tracking-wider text-[#1A1407]">
              ★ VIP
            </span>
          )}
          {logoUrl ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={logoUrl}
                alt={brand}
                className="mx-auto mb-2 h-8 w-auto object-contain"
              />
            </>
          ) : (
            <p className={`text-xs uppercase tracking-[0.2em] ${vip ? "text-[#C9A227]" : darkText ? "text-neutral-700" : "text-white/70"}`}>
              {brand} · Ingresso
            </p>
          )}
          <h1 className="mt-1 text-xl font-bold">{ticket.event.name}</h1>
          <p className={`mt-1 text-sm ${mutedText}`}>
            {dateLabel}
            {timeLabel ? ` · ${timeLabel}` : ""}
          </p>
          {(ticket.event.locationName || ticket.event.address) && (
            <p className={`text-sm ${mutedText}`}>
              {ticket.event.locationName || ticket.event.address}
            </p>
          )}
        </div>

        {/* Recorte perfurado */}
        <div className={`relative h-4 ${headerClass}`} style={headerStyle}>
          <div className="absolute -left-2 top-1/2 h-4 w-4 -translate-y-1/2 rounded-full bg-neutral-900" />
          <div className="absolute inset-x-3 top-1/2 -translate-y-1/2 border-t border-dashed border-white/40" />
          <div className="absolute -right-2 top-1/2 h-4 w-4 -translate-y-1/2 rounded-full bg-neutral-900" />
        </div>

        {/* Corpo com o QR */}
        <div className="px-6 py-6 text-center" style={bodyBgStyle}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={dataUrl}
            alt="QR Code de check-in"
            className="mx-auto w-60 rounded-lg"
          />
          <p className="mt-4 text-lg font-semibold">{ticket.guest.name}</p>

          {checkedIn ? (
            <>
              <p className="mt-3 rounded-md bg-green-50 px-3 py-2 text-sm font-medium text-green-700">
                ✓ Check-in realizado
                {ticket.checkedInAt
                  ? ` às ${ticket.checkedInAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`
                  : ""}
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <a
                  href={`/api/ticket/${ticket.token}/certificate`}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-md border px-3 py-2 text-sm font-medium hover:bg-neutral-50"
                >
                  Certificado
                </a>
                <a
                  href={`/nps/${ticket.token}`}
                  className="rounded-md border px-3 py-2 text-sm font-medium hover:bg-neutral-50"
                >
                  Avaliar evento
                </a>
              </div>
            </>
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
