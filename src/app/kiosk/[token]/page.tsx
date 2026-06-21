import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { KioskClient } from "@/components/kiosk/kiosk-client";

export const dynamic = "force-dynamic";

// Página pública do totem de auto-checkin (#5). Escopo pelo kioskToken.
export default async function KioskPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const event = await prisma.event.findUnique({
    where: { kioskToken: token },
    select: {
      name: true,
      status: true,
      organization: {
        select: { brandName: true, logoUrl: true, primaryColor: true },
      },
    },
  });
  if (!event) notFound();

  return (
    <KioskClient
      token={token}
      eventName={event.name}
      active={event.status === "active"}
      brandName={event.organization?.brandName ?? null}
      logoUrl={event.organization?.logoUrl ?? null}
      primaryColor={event.organization?.primaryColor ?? null}
    />
  );
}
