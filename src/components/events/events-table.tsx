"use client";

import { useRouter } from "next/navigation";
import { Calendar, ChevronRight, Clock, MapPin } from "lucide-react";
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
  capacity: number | null;
  guests: number;
  checkedIn: number;
  status: string;
};

function formatDate(iso: string) {
  return new Date(iso + "T00:00:00Z").toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

// Tabela de eventos com a LINHA INTEIRA clicável (abre o evento). Mantém
// acessibilidade: role=link, foco por teclado e Enter/Espaço navegam.
export function EventsTable({ events }: { events: EventListItem[] }) {
  const router = useRouter();

  function open(id: string) {
    router.push(`/events/${id}`);
  }

  if (events.length === 0) {
    return (
      <div className="rounded-xl border bg-card">
        <EmptyState
          icon={Calendar}
          title="Nenhum evento ainda"
          description="Crie o primeiro evento com o botão acima."
        />
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>Evento</TableHead>
            <TableHead className="hidden md:table-cell">Data</TableHead>
            <TableHead className="hidden lg:table-cell">Local</TableHead>
            <TableHead>Comparecimento</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-8" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {events.map((event) => {
            const denom = event.capacity ?? event.guests;
            const pct =
              denom > 0 ? Math.min(100, Math.round((event.checkedIn / denom) * 100)) : 0;
            return (
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
                className="group cursor-pointer"
              >
                <TableCell>
                  <div className="font-medium">{event.name}</div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground md:hidden">
                    <Calendar className="size-3" /> {formatDate(event.date)}
                  </div>
                </TableCell>
                <TableCell className="hidden whitespace-nowrap text-sm md:table-cell">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="size-3.5 text-muted-foreground" />
                    {formatDate(event.date)}
                  </div>
                  {event.startTime && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Clock className="size-3" /> {event.startTime}
                    </div>
                  )}
                </TableCell>
                <TableCell className="hidden max-w-[200px] lg:table-cell">
                  {event.locationName ? (
                    <span className="flex items-center gap-1.5 truncate text-sm text-muted-foreground">
                      <MapPin className="size-3.5 shrink-0" />
                      <span className="truncate">{event.locationName}</span>
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="min-w-[140px]">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{event.checkedIn}</span>
                    <span className="text-xs text-muted-foreground">
                      de {denom || event.guests}
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={EVENT_STATUS_VARIANT[event.status] ?? "secondary"}>
                    {EVENT_STATUS_LABEL[event.status] ?? event.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  <ChevronRight className="size-4 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5 group-hover:text-muted-foreground" />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
