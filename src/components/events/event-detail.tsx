"use client";

import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GuestsTab } from "@/components/events/guests-tab";
import { QrDeliveryTab } from "@/components/events/qr-delivery-tab";
import { CheckerTab } from "@/components/events/checker-tab";
import { SettingsTab } from "@/components/events/settings-tab";
import { ActivityTab } from "@/components/events/activity-tab";
import { EVENT_STATUS_LABEL, EVENT_STATUS_VARIANT } from "@/components/events/status";

export type EventData = {
  id: string;
  name: string;
  slug: string;
  date: string;
  startTime: string | null;
  endTime: string | null;
  locationName: string | null;
  address: string | null;
  capacity: number | null;
  status: string;
  checkerToken: string;
  checkerPin: string;
};

export type GuestRow = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  source: string;
  status: string;
  ticketToken: string | null;
  checkedInAt: string | null;
};

export type LogRow = {
  id: string;
  status: string;
  message: string | null;
  guestName: string | null;
  scannedAt: string;
  deviceInfo: string | null;
};

export type ReportData = {
  guests: number;
  qrGenerated: number;
  checkedIn: number;
  noShow: number;
  duplicateAttempts: number;
  invalidAttempts: number;
};

export function EventDetail({
  event,
  guests,
  logs,
  report,
  appBaseUrl,
}: {
  event: EventData;
  guests: GuestRow[];
  logs: LogRow[];
  report: ReportData;
  appBaseUrl: string;
}) {
  const router = useRouter();
  const refresh = () => router.refresh();

  const metrics = [
    { label: "Convidados", value: report.guests },
    {
      label: "QR gerados",
      value: report.qrGenerated,
    },
    {
      label: "Check-ins",
      value:
        event.capacity != null
          ? `${report.checkedIn}/${event.capacity}`
          : report.checkedIn,
    },
    { label: "Ausentes", value: report.noShow },
    { label: "Duplicados", value: report.duplicateAttempts },
    { label: "Inválidos", value: report.invalidAttempts },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">{event.name}</h1>
        <Badge variant={EVENT_STATUS_VARIANT[event.status] ?? "secondary"}>
          {EVENT_STATUS_LABEL[event.status] ?? event.status}
        </Badge>
        <span className="text-sm text-neutral-500">
          {event.date}
          {event.startTime ? ` · ${event.startTime}` : ""}
          {event.locationName ? ` · ${event.locationName}` : ""}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-3 md:grid-cols-6">
        {metrics.map((m) => (
          <Card key={m.label}>
            <CardHeader className="pb-1">
              <CardTitle className="text-xs font-medium text-neutral-500">
                {m.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{m.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="guests">
        <TabsList>
          <TabsTrigger value="guests">Convidados</TabsTrigger>
          <TabsTrigger value="qr">QR Delivery</TabsTrigger>
          <TabsTrigger value="checker">Checker</TabsTrigger>
          <TabsTrigger value="settings">Configurações</TabsTrigger>
          <TabsTrigger value="activity">Atividade</TabsTrigger>
        </TabsList>
        <TabsContent value="guests">
          <GuestsTab event={event} guests={guests} onChange={refresh} />
        </TabsContent>
        <TabsContent value="qr">
          <QrDeliveryTab
            event={event}
            guests={guests}
            appBaseUrl={appBaseUrl}
            onChange={refresh}
          />
        </TabsContent>
        <TabsContent value="checker">
          <CheckerTab event={event} appBaseUrl={appBaseUrl} />
        </TabsContent>
        <TabsContent value="settings">
          <SettingsTab event={event} onChange={refresh} />
        </TabsContent>
        <TabsContent value="activity">
          <ActivityTab logs={logs} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
