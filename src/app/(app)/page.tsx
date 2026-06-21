import Link from "next/link";
import {
  ArrowRight,
  Calendar,
  CalendarCheck,
  CalendarPlus,
  CheckCircle2,
  MapPin,
  PlugZap,
  QrCode,
  Users,
} from "lucide-react";
import { getCurrentOrgId } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { MetricCard } from "@/components/ui/metric-card";
import { EmptyState } from "@/components/ui/empty-state";
import {
  EVENT_STATUS_LABEL,
  EVENT_STATUS_VARIANT,
} from "@/components/events/status";
import { CreateEventDialog } from "@/components/events/create-event-dialog";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const organizationId = await getCurrentOrgId();
  const orgFilter = { event: { organizationId } };

  const [events, activeEvents, guests, checkedIn, qrGenerated, upcoming] =
    await Promise.all([
      prisma.event.count({ where: { organizationId } }),
      prisma.event.count({ where: { organizationId, status: "active" } }),
      prisma.guest.count({ where: { ...orgFilter, status: { not: "canceled" } } }),
      prisma.ticket.count({ where: { ...orgFilter, status: "checked_in" } }),
      prisma.ticket.count({ where: { ...orgFilter, status: { not: "canceled" } } }),
      prisma.event.findMany({
        where: { organizationId, status: { notIn: ["completed", "canceled"] } },
        orderBy: { date: "asc" },
        take: 5,
        include: { _count: { select: { guests: true } } },
      }),
    ]);

  const metrics = [
    { label: "Eventos", value: events, icon: Calendar, accent: "primary" as const },
    { label: "Ativos", value: activeEvents, icon: CalendarCheck, accent: "success" as const },
    { label: "Convidados", value: guests, icon: Users, accent: "violet" as const },
    { label: "QR gerados", value: qrGenerated, icon: QrCode, accent: "muted" as const },
    { label: "Check-ins", value: checkedIn, icon: CheckCircle2, accent: "amber" as const },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Visão geral dos eventos, convidados e check-ins."
        actions={<CreateEventDialog />}
      />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
        {metrics.map((m) => (
          <MetricCard
            key={m.label}
            label={m.label}
            value={m.value}
            icon={m.icon}
            accent={m.accent}
          />
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardContent className="p-0">
            <div className="flex items-center justify-between border-b px-5 py-3.5">
              <p className="font-medium">Próximos eventos</p>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/events">
                  Ver todos <ArrowRight className="size-4" />
                </Link>
              </Button>
            </div>
            {upcoming.length === 0 ? (
              <EmptyState
                icon={Calendar}
                title="Nenhum evento agendado"
                description="Crie seu primeiro evento para começar a credenciar."
              />
            ) : (
              <ul className="divide-y">
                {upcoming.map((ev) => (
                  <li key={ev.id}>
                    <Link
                      href={`/events/${ev.id}`}
                      className="flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-muted/50"
                    >
                      <span className="flex size-10 shrink-0 flex-col items-center justify-center rounded-lg bg-muted text-center leading-none">
                        <span className="text-[10px] uppercase text-muted-foreground">
                          {new Date(ev.date).toLocaleDateString("pt-BR", {
                            month: "short",
                            timeZone: "UTC",
                          })}
                        </span>
                        <span className="text-sm font-bold">
                          {new Date(ev.date).getUTCDate()}
                        </span>
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{ev.name}</span>
                        <span className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Users className="size-3" /> {ev._count.guests}
                          {ev.locationName && (
                            <>
                              <MapPin className="ml-1 size-3" />
                              <span className="truncate">{ev.locationName}</span>
                            </>
                          )}
                        </span>
                      </span>
                      <Badge variant={EVENT_STATUS_VARIANT[ev.status] ?? "secondary"}>
                        {EVENT_STATUS_LABEL[ev.status] ?? ev.status}
                      </Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0">
            <div className="border-b px-5 py-3.5">
              <p className="font-medium">Ações rápidas</p>
            </div>
            <div className="flex flex-col p-3">
              <QuickAction
                href="/events"
                icon={CalendarPlus}
                title="Gerenciar eventos"
                desc="Criar, editar e acompanhar"
              />
              <QuickAction
                href="/contacts"
                icon={Users}
                title="Contatos"
                desc="Base de convidados do CRM"
              />
              <QuickAction
                href="/connection"
                icon={PlugZap}
                title="Conexão GHL"
                desc="Integração com o CRM"
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function QuickAction({
  href,
  icon: Icon,
  title,
  desc,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  desc: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-muted/60"
    >
      <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="size-[18px]" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{title}</span>
        <span className="block truncate text-xs text-muted-foreground">{desc}</span>
      </span>
      <ArrowRight className="size-4 text-muted-foreground" />
    </Link>
  );
}
