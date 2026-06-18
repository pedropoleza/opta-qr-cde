import Link from "next/link";
import { getCurrentOrgId } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

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
    { label: "Eventos", value: events },
    { label: "Eventos ativos", value: activeEvents },
    { label: "Convidados", value: guests },
    { label: "QR Codes gerados", value: qrGenerated },
    { label: "Check-ins", value: checkedIn },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <Button asChild>
          <Link href="/events">Ver eventos</Link>
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        {metrics.map((m) => (
          <Card key={m.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-neutral-500">
                {m.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{m.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
