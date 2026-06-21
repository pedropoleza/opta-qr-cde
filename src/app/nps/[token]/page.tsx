import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { NpsClient } from "@/components/nps/nps-client";

export const dynamic = "force-dynamic";

// Pesquisa/NPS pós-evento (#9). Pública pelo token do ingresso.
export default async function NpsPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const ticket = await prisma.ticket.findUnique({
    where: { token },
    select: {
      status: true,
      event: {
        select: {
          name: true,
          organization: {
            select: { brandName: true, primaryColor: true },
          },
        },
      },
      guest: { select: { name: true, npsScore: true } },
    },
  });
  if (!ticket) notFound();

  return (
    <NpsClient
      token={token}
      eventName={ticket.event.name}
      guestName={ticket.guest.name}
      alreadyScored={ticket.guest.npsScore != null}
      checkedIn={ticket.status === "checked_in"}
      brandName={ticket.event.organization?.brandName ?? null}
      primaryColor={ticket.event.organization?.primaryColor ?? null}
    />
  );
}
