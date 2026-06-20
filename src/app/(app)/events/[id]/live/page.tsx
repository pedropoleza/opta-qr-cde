import { notFound } from "next/navigation";
import { getCurrentOrgId } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { LiveClient } from "@/components/events/live-client";

export const dynamic = "force-dynamic";

// #7 Telão de operação ao vivo do evento.
export default async function EventLivePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const organizationId = await getCurrentOrgId();
  const { id } = await params;
  const event = await prisma.event.findFirst({
    where: { id, organizationId },
    select: { id: true, name: true },
  });
  if (!event) notFound();

  return <LiveClient eventId={event.id} eventName={event.name} />;
}
