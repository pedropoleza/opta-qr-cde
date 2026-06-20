import { getCurrentOrgId } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { ContactsClient } from "@/components/contacts/contacts-client";

export const dynamic = "force-dynamic";

// Aba Contatos: puxa contatos do Spark, mostra em quais eventos cada um está e
// permite cadastrá-los em um evento.
export default async function ContactsPage() {
  const organizationId = await getCurrentOrgId();
  const events = await prisma.event.findMany({
    where: { organizationId, status: { not: "canceled" } },
    orderBy: { date: "desc" },
    select: { id: true, name: true },
  });

  return <ContactsClient events={events} />;
}
