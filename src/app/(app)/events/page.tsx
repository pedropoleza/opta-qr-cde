import { getCurrentOrgId } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { CreateEventDialog } from "@/components/events/create-event-dialog";
import { SyncSquareButton } from "@/components/events/sync-square-button";
import { squareConfigured } from "@/lib/square-api";
import { PageHeader } from "@/components/ui/page-header";
import { EventsTable } from "@/components/events/events-table";

export const dynamic = "force-dynamic";

export default async function EventsPage() {
  const organizationId = await getCurrentOrgId();
  const events = await prisma.event.findMany({
    where: { organizationId },
    orderBy: { date: "desc" },
    include: {
      _count: { select: { guests: true } },
      tickets: { where: { status: "checked_in" }, select: { id: true } },
    },
  });

  const rows = events.map((event) => ({
    id: event.id,
    name: event.name,
    date: event.date.toISOString().slice(0, 10),
    startTime: event.startTime,
    locationName: event.locationName,
    capacity: event.capacity,
    guests: event._count.guests,
    checkedIn: event.tickets.length,
    status: event.status,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Eventos"
        description="Crie e gerencie seus eventos de credenciamento."
        actions={
          <div className="flex items-center gap-2">
            {squareConfigured() && <SyncSquareButton />}
            <CreateEventDialog />
          </div>
        }
      />
      <EventsTable events={rows} />
    </div>
  );
}
