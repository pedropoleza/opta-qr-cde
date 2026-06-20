import Link from "next/link";
import {
  Calendar,
  CalendarCheck,
  CheckCircle2,
  QrCode,
  Users,
} from "lucide-react";
import { getCurrentOrgId } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { MetricCard } from "@/components/ui/metric-card";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const organizationId = await getCurrentOrgId();
  const orgFilter = { event: { organizationId } };

  const [events, activeEvents, guests, checkedIn, qrGenerated] = await Promise.all([
    prisma.event.count({ where: { organizationId } }),
    prisma.event.count({
      where: { organizationId, status: "active" },
    }),
    prisma.guest.count({ where: { ...orgFilter, status: { not: "canceled" } } }),
    prisma.ticket.count({ where: { ...orgFilter, status: "checked_in" } }),
    prisma.ticket.count({ where: { ...orgFilter, status: { not: "canceled" } } }),
  ]);

  const metrics = [
    { label: "Eventos", value: events, icon: Calendar },
    { label: "Eventos ativos", value: activeEvents, icon: CalendarCheck },
    { label: "Convidados", value: guests, icon: Users },
    { label: "QR Codes gerados", value: qrGenerated, icon: QrCode },
    { label: "Check-ins", value: checkedIn, icon: CheckCircle2 },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Visão geral dos eventos, convidados e check-ins."
        actions={
          <Button asChild>
            <Link href="/events">Ver eventos</Link>
          </Button>
        }
      />
      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        {metrics.map((m) => (
          <MetricCard
            key={m.label}
            label={m.label}
            value={m.value}
            icon={m.icon}
          />
        ))}
      </div>
    </div>
  );
}
