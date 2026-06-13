import { prisma } from "@/lib/prisma";
import { verifyTicketSignature } from "@/lib/ticket";

export const dynamic = "force-dynamic";

// Landing da URL embutida no QR (seção 2.4). O check-in NUNCA acontece por
// GET — prefetch de e-mail/navegador não pode consumir o ticket. Esta página
// apenas informa o estado; a validação real é feita pelo Checker (POST
// /api/checkin/validate com sessão autorizada).
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
    <div className="flex min-h-screen flex-col items-center justify-center bg-neutral-50 p-6 text-center">
      <div className="w-full max-w-sm rounded-xl border bg-white p-6 shadow-sm">
        {status === "invalid" ? (
          <>
            <p className="text-4xl">❌</p>
            <h1 className="mt-2 text-xl font-bold text-red-600">QR Code inválido</h1>
            <p className="mt-2 text-sm text-neutral-500">
              Este código não é válido. Procure a equipe do evento.
            </p>
          </>
        ) : (
          <>
            <p className="text-4xl">{status === "checked_in" ? "✅" : "🎟️"}</p>
            <h1 className="mt-2 text-xl font-bold">{guestName}</h1>
            <p className="text-sm text-neutral-500">{eventName}</p>
            <p className="mt-3 rounded-md bg-neutral-100 px-3 py-2 text-sm">
              {status === "checked_in"
                ? "Check-in já realizado."
                : "Ticket válido. O check-in é feito pelo scanner da equipe na entrada do evento."}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
