import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { CheckerClient } from "@/components/checker/checker-client";

export const dynamic = "force-dynamic";

export default async function CheckerPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const event = await prisma.event.findUnique({
    where: { checkerToken: token },
    select: { id: true, name: true, status: true },
  });
  if (!event) notFound();

  return (
    <CheckerClient
      checkerToken={token}
      eventName={event.name}
      eventStatus={event.status}
    />
  );
}
