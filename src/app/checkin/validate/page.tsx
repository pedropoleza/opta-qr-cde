import { prisma } from "@/lib/prisma";
import { verifyTicketSignature } from "@/lib/ticket";

export const dynamic = "force-dynamic";

// Check animado (CSS puro — renderizável no servidor, sem JS).
function AnimatedCheck() {
  return (
    <div className="relative mx-auto flex size-20 items-center justify-center">
      <span className="spark-ring absolute size-20 rounded-full bg-emerald-500/25" />
      <span
        className="spark-ring absolute size-20 rounded-full bg-emerald-500/20"
        style={{ animationDelay: "0.5s" }}
      />
      <div className="spark-pop relative flex size-20 items-center justify-center rounded-full bg-emerald-500 shadow-lg">
        <svg viewBox="0 0 52 52" className="size-11" aria-hidden>
          <path
            d="M16 27 l7 7 l14 -16"
            fill="none"
            stroke="#ffffff"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              strokeDasharray: 48,
              strokeDashoffset: 48,
              animation: "spark-check-mark 0.4s ease-out 0.3s forwards",
            }}
          />
        </svg>
      </div>
    </div>
  );
}

// Landing da URL embutida no QR (seção 2.4). O check-in NUNCA acontece por
// GET — prefetch de e-mail/navegador não pode consumir o ticket. Esta página
// apenas informa o estado; a validação real é feita pelo Checker.
export default async function ValidateLandingPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; sig?: string }>;
}) {
  const { token, sig } = await searchParams;

  let status: "ok" | "checked_in" | "invalid" = "invalid";
  let guestName = "";
  let eventName = "";

  if (token && sig) {
    const ticket = await prisma.ticket.findUnique({
      where: { token },
      include: { guest: true, event: true },
    });
    if (
      ticket &&
      verifyTicketSignature(ticket.eventId, ticket.guestId, token, sig) &&
      ticket.status !== "canceled" &&
      ticket.guest.status !== "canceled"
    ) {
      status = ticket.status === "checked_in" ? "checked_in" : "ok";
      guestName = ticket.guest.name;
      eventName = ticket.event.name;
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-6 text-center">
      <div className="w-full max-w-sm rounded-2xl border bg-card p-8 shadow-sm">
        {status === "invalid" && (
          <>
            <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-destructive/10 text-3xl">
              ❌
            </div>
            <h1 className="mt-4 text-xl font-bold text-destructive">
              QR Code inválido
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Este código não é válido. Procure a equipe do evento.
            </p>
          </>
        )}

        {status === "checked_in" && (
          <>
            <AnimatedCheck />
            <p
              className="spark-fade-up mt-5 text-xs font-semibold tracking-widest text-emerald-600 uppercase"
              style={{ animationDelay: "0.5s" }}
            >
              Presença confirmada
            </p>
            <h1
              className="spark-fade-up mt-1 text-2xl font-bold"
              style={{ animationDelay: "0.6s" }}
            >
              {guestName}
            </h1>
            <p
              className="spark-fade-up text-sm text-muted-foreground"
              style={{ animationDelay: "0.68s" }}
            >
              {eventName}
            </p>
            <p
              className="spark-fade-up mt-4 text-base font-medium"
              style={{ animationDelay: "0.78s" }}
            >
              Obrigado por vir! 🎉
            </p>
          </>
        )}

        {status === "ok" && (
          <>
            <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-primary/10 text-3xl">
              🎟️
            </div>
            <h1 className="mt-4 text-xl font-bold">{guestName}</h1>
            <p className="text-sm text-muted-foreground">{eventName}</p>
            <p className="mt-4 rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
              Ingresso válido. O check-in é feito pelo scanner da equipe na
              entrada do evento.
            </p>
            {token && (
              <a
                href={`/api/ticket/${encodeURIComponent(token)}/pdf`}
                target="_blank"
                rel="noreferrer"
                className="mt-4 inline-block text-sm font-medium text-primary underline-offset-4 hover:underline"
              >
                Ver ingresso em PDF
              </a>
            )}
          </>
        )}
      </div>
    </div>
  );
}
