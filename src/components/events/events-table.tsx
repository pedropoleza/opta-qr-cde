"use client";

import { useRouter } from "next/navigation";
import { Calendar } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import {
  EVENT_STATUS_LABEL,
  EVENT_STATUS_VARIANT,
} from "@/components/events/status";

export type EventListItem = {
  id: string;
  name: string;
  date: string;
  startTime: string | null;
  locationName: string | null;
  guests: number;
  checkedIn: number;
  status: string;
};

// Tabela de eventos com a LINHA INTEIRA clicável (abre o evento). Mantém
// acessibilidade: role=link, foco por teclado e Enter/Espaço navegam.
export function EventsTable({ events }: { events: EventListItem[] }) {
  const router = useRouter();

  function open(id: string) {
    router.push(`/events/${id}`);
  }

  return (
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
              <TableCell colSpan={6} className="p-0">
                <EmptyState
                  icon={Calendar}
                  title="Nenhum evento ainda"
                  description="Crie o primeiro evento com o botão acima."
                />
              </TableCell>
            </TableRow>
          )}
          {events.map((event) => (
            <TableRow
              key={event.id}
              role="link"
              tabIndex={0}
              aria-label={`Abrir evento ${event.name}`}
              onClick={() => open(event.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  open(event.id);
                }
              }}
              className="cursor-pointer"
            >
              <TableCell className="font-medium">{event.name}</TableCell>
              <TableCell>
                {event.date}
                {event.startTime ? ` ${event.startTime}` : ""}
              </TableCell>
              <TableCell>{event.locationName ?? "—"}</TableCell>
              <TableCell>{event.guests}</TableCell>
              <TableCell>{event.checkedIn}</TableCell>
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
  );
}
