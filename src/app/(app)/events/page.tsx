import Link from "next/link";
import { getCurrentOrgId } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CreateEventDialog } from "@/components/events/create-event-dialog";
import { PageHeader } from "@/components/ui/page-header";
import { EVENT_STATUS_LABEL, EVENT_STATUS_VARIANT } from "@/components/events/status";

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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Eventos"
        description="Crie e gerencie seus eventos de credenciamento."
        actions={<CreateEventDialog />}
      />
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Evento</TableHead>
              <TableHead>Data</TableHead>
              <TableHead>Local</TableHead>
              <TableHead>Convidados</TableHead>
              <TableHead>Check-ins</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {events.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                  Nenhum evento ainda. Crie o primeiro com o botão acima.
                </TableCell>
              </TableRow>
            )}
            {events.map((event) => (
              <TableRow key={event.id}>
                <TableCell>
                  <Link
                    href={`/events/${event.id}`}
                    className="font-medium hover:underline"
                  >
                    {event.name}
                  </Link>
                </TableCell>
                <TableCell>
                  {event.date.toISOString().slice(0, 10)}
                  {event.startTime ? ` ${event.startTime}` : ""}
                </TableCell>
                <TableCell>{event.locationName ?? "—"}</TableCell>
                <TableCell>{event._count.guests}</TableCell>
                <TableCell>{event.tickets.length}</TableCell>
                <TableCell>
                  <Badge variant={EVENT_STATUS_VARIANT[event.status] ?? "secondary"}>
                    {EVENT_STATUS_LABEL[event.status] ?? event.status}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
