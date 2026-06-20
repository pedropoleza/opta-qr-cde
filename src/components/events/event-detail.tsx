"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarClock,
  CheckCircle2,
  CopyPlus,
  Download,
  Loader2,
  MoreHorizontal,
  QrCode,
  UserMinus,
  Users,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MetricCard } from "@/components/ui/metric-card";
import { HelpModal } from "@/components/ui/help-modal";
import { GuestsTab } from "@/components/events/guests-tab";
import { QrDeliveryTab } from "@/components/events/qr-delivery-tab";
import { CheckerTab } from "@/components/events/checker-tab";
import { SettingsTab } from "@/components/events/settings-tab";
import { ActivityTab } from "@/components/events/activity-tab";
import {
  EVENT_STATUS_LABEL,
  EVENT_STATUS_VARIANT,
  GUEST_STATUS_LABEL,
} from "@/components/events/status";

function csvCell(value: string) {
  const s = String(value ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

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
  const [duplicating, setDuplicating] = useState(false);

  // #5 Exportar relatório: CSV dos convidados (nome, contato, status, check-in).
  function exportCsv() {
    const header = ["Nome", "E-mail", "Telefone", "Status", "Check-in"];
    const lines = guests.map((g) => [
      g.name,
      g.email ?? "",
      g.phone ?? "",
      GUEST_STATUS_LABEL[g.status] ?? g.status,
      g.checkedInAt ? new Date(g.checkedInAt).toLocaleString("pt-BR") : "",
    ]);
    const csv = [header, ...lines]
      .map((row) => row.map(csvCell).join(","))
      .join("\n");
    const blob = new Blob(["﻿" + csv], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${event.slug}-convidados.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Relatório exportado");
  }

  // #6 Duplicar evento: cria um rascunho com a mesma configuração.
  async function duplicate() {
    setDuplicating(true);
    const res = await fetch(`/api/events/${event.id}/duplicate`, {
      method: "POST",
    });
    const data = await res.json().catch(() => ({}));
    setDuplicating(false);
    if (!res.ok) {
      toast.error(data.error ?? "Erro ao duplicar evento");
      return;
    }
    toast.success("Evento duplicado");
    router.push(`/events/${data.event.id}`);
  }

  const metrics = [
    { label: "Convidados", value: report.guests, icon: Users },
    { label: "QR gerados", value: report.qrGenerated, icon: QrCode },
    {
      label: "Check-ins",
      value:
        event.capacity != null
          ? `${report.checkedIn}/${event.capacity}`
          : report.checkedIn,
      icon: CheckCircle2,
    },
    { label: "Ausentes", value: report.noShow, icon: UserMinus },
    { label: "Duplicados", value: report.duplicateAttempts, icon: CalendarClock },
    { label: "Inválidos", value: report.invalidAttempts, icon: XCircle },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold tracking-tight">{event.name}</h1>
        <Badge variant={EVENT_STATUS_VARIANT[event.status] ?? "secondary"}>
          {EVENT_STATUS_LABEL[event.status] ?? event.status}
        </Badge>
        <span className="text-sm text-muted-foreground">
          {event.date}
          {event.startTime ? ` · ${event.startTime}` : ""}
          {event.locationName ? ` · ${event.locationName}` : ""}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={exportCsv}>
            <Download /> Exportar CSV
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon-sm" aria-label="Mais ações">
                {duplicating ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <MoreHorizontal />
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={duplicate} disabled={duplicating}>
                <CopyPlus className="size-4" /> Duplicar evento
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <HelpModal
            title="Como funciona o Spark Check-in"
            description="Do convite ao check-in na porta, em 4 passos."
          >
            <ol className="list-decimal space-y-2 pl-4">
              <li>
                <strong className="text-foreground">Convidados</strong>: importe
                por CSV ou Spark (tag) e gere um QR Code único e assinado por
                pessoa.
              </li>
              <li>
                <strong className="text-foreground">QR Delivery</strong>: envie o
                ingresso por e-mail — o Spark prepara o contato e o workflow do
                CRM dispara a mensagem.
              </li>
              <li>
                <strong className="text-foreground">Checker</strong>: na entrada,
                abra o link do Checker com o PIN e escaneie os QRs. Cada código
                faz check-in uma única vez.
              </li>
              <li>
                <strong className="text-foreground">Atividade</strong>: acompanhe
                check-ins, duplicados e inválidos em tempo real.
              </li>
            </ol>
          </HelpModal>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 md:grid-cols-6">
        {metrics.map((m) => (
          <MetricCard
            key={m.label}
            label={m.label}
            value={m.value}
            icon={m.icon}
          />
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
