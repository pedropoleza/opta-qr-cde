"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CalendarClock,
  CheckCircle2,
  Activity,
  CopyPlus,
  CreditCard,
  DollarSign,
  DoorOpen,
  Download,
  Loader2,
  MapPin,
  MonitorPlay,
  MoreHorizontal,
  QrCode,
  ScanLine,
  Send,
  Settings2,
  Ticket,
  UserMinus,
  Users,
  Wallet,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
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
import { SessionsTab } from "@/components/events/sessions-tab";
import { QrDeliveryTab } from "@/components/events/qr-delivery-tab";
import { PaymentsTab } from "@/components/events/payments-tab";
import { MessagesTab } from "@/components/events/messages-tab";
import { CheckerTab } from "@/components/events/checker-tab";
import { SettingsTab } from "@/components/events/settings-tab";
import { ActivityTab } from "@/components/events/activity-tab";
import { FlowTab, type FlowData } from "@/components/events/flow-tab";
import {
  EVENT_STATUS_LABEL,
  EVENT_STATUS_VARIANT,
  GUEST_STATUS_LABEL,
} from "@/components/events/status";

function csvCell(value: string) {
  const s = String(value ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// Sub-navegação segmentada dentro de uma aba (reduz o número de abas no topo).
function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div className="mb-5 inline-flex rounded-lg border bg-muted/40 p-1 text-sm">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded-md px-3.5 py-1.5 font-medium transition-colors",
            value === o.value
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
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
  vipNotifyChannel: string | null;
  vipNotifyTarget: string | null;
};

export type GuestRow = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  tier: string | null;
  rsvp: string | null;
  groupSize: number;
  groupId: string | null;
  sessionId: string | null;
  waitlisted: boolean;
  vip: boolean;
  paymentStatus: string;
  amountPaid: number | null;
  currency: string | null;
  source: string;
  status: string;
  ticketToken: string | null;
  checkedInAt: string | null;
  emailStatus: string | null;
  emailSentAt: string | null;
};

export type LogRow = {
  id: string;
  status: string;
  message: string | null;
  guestId: string | null;
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
  insideNow: number;
  paid: number;
  pendingPayment: number;
  revenueCents: number;
  currency: string;
};

export type SessionInfo = {
  id: string;
  name: string;
  capacity: number | null;
  startsAt: string | null;
  assigned: number;
  checkedIn: number;
};

export function EventDetail({
  event,
  guests,
  logs,
  report,
  sessions,
  flow,
  appBaseUrl,
}: {
  event: EventData;
  guests: GuestRow[];
  logs: LogRow[];
  report: ReportData;
  sessions: SessionInfo[];
  flow: FlowData;
  appBaseUrl: string;
}) {
  const router = useRouter();
  const refresh = () => router.refresh();
  const [duplicating, setDuplicating] = useState(false);
  const [enviosView, setEnviosView] = useState<"qr" | "messages">("qr");
  const [opView, setOpView] = useState<"checker" | "sessions" | "flow">("checker");

  // #8 Check-in ao vivo: revalida os dados a cada 10s enquanto ligado.
  const [live, setLive] = useState(false);
  useEffect(() => {
    if (!live) return;
    const t = setInterval(() => router.refresh(), 10_000);
    return () => clearInterval(t);
  }, [live, router]);

  // #5 Exportar relatório: CSV dos convidados (nome, contato, status, check-in).
  function exportCsv() {
    const header = [
      "Nome",
      "E-mail",
      "Telefone",
      "Status",
      "Pagamento",
      "Valor",
      "Check-in",
    ];
    const lines = guests.map((g) => [
      g.name,
      g.email ?? "",
      g.phone ?? "",
      g.waitlisted ? "Lista de espera" : GUEST_STATUS_LABEL[g.status] ?? g.status,
      g.paymentStatus === "none" ? "" : g.paymentStatus,
      g.amountPaid != null ? (g.amountPaid / 100).toFixed(2) : "",
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

  // #1 Capacidade & lista de espera.
  const confirmed = guests.filter(
    (g) => g.status !== "canceled" && !g.waitlisted,
  ).length;
  const waitlist = guests.filter((g) => g.waitlisted).length;
  const capacity = event.capacity;
  const occupancyPct =
    capacity != null && capacity > 0
      ? Math.min(100, Math.round((confirmed / capacity) * 100))
      : null;
  const [promoting, setPromoting] = useState(false);

  async function promoteWaitlist() {
    setPromoting(true);
    const res = await fetch(`/api/events/${event.id}/capacity`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const data = await res.json().catch(() => ({}));
    setPromoting(false);
    if (!res.ok) {
      toast.error(data.error ?? "Erro ao promover");
      return;
    }
    if (data.promoted > 0) {
      toast.success(
        `${data.promoted} convidado(s) promovido(s) da lista de espera`,
      );
      router.refresh();
    } else {
      toast.info("Sem vagas livres para promover");
    }
  }

  const hasPayments = report.paid > 0 || report.pendingPayment > 0;
  const revenue = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: report.currency || "BRL",
  }).format(report.revenueCents / 100);
  const paymentMetrics = [
    { label: "Inscritos", value: report.guests, icon: Users, accent: "violet" as const },
    { label: "Pagos", value: report.paid, icon: Ticket, accent: "success" as const },
    { label: "Pendentes", value: report.pendingPayment, icon: Wallet, accent: "amber" as const },
    { label: "Receita", value: revenue, icon: DollarSign, accent: "primary" as const },
  ];

  const metrics = [
    { label: "Convidados", value: report.guests, icon: Users, accent: "primary" as const },
    { label: "QR gerados", value: report.qrGenerated, icon: QrCode, accent: "muted" as const },
    {
      label: "Check-ins",
      value:
        event.capacity != null
          ? `${report.checkedIn}/${event.capacity}`
          : report.checkedIn,
      icon: CheckCircle2,
      accent: "success" as const,
    },
    { label: "Dentro agora", value: report.insideNow, icon: DoorOpen, accent: "violet" as const },
    { label: "Ausentes", value: report.noShow, icon: UserMinus, accent: "muted" as const },
    { label: "Duplicados", value: report.duplicateAttempts, icon: CalendarClock, accent: "amber" as const },
    { label: "Inválidos", value: report.invalidAttempts, icon: XCircle, accent: "destructive" as const },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight">{event.name}</h1>
            <Badge variant={EVENT_STATUS_VARIANT[event.status] ?? "secondary"}>
              {EVENT_STATUS_LABEL[event.status] ?? event.status}
            </Badge>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <CalendarClock className="size-3.5" />
              {event.date}
              {event.startTime ? ` · ${event.startTime}` : ""}
            </span>
            {event.locationName && (
              <span className="flex items-center gap-1.5">
                <MapPin className="size-3.5" />
                {event.locationName}
              </span>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            variant={live ? "default" : "outline"}
            size="sm"
            aria-pressed={live}
            onClick={() => setLive((v) => !v)}
          >
            <span
              className={
                live
                  ? "size-2 rounded-full bg-current animate-pulse"
                  : "size-2 rounded-full bg-muted-foreground/50"
              }
            />
            Ao vivo
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/events/${event.id}/live`}>
              <MonitorPlay /> Painel ao vivo
            </Link>
          </Button>
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

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
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

      {hasPayments && (
        <div>
          <p className="mb-2 text-sm font-medium text-muted-foreground">
            Inscrições & receita
          </p>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {paymentMetrics.map((m) => (
              <MetricCard
                key={m.label}
                label={m.label}
                value={m.value}
                icon={m.icon}
                accent={m.accent}
              />
            ))}
          </div>
        </div>
      )}

      {(capacity != null || waitlist > 0) && (
        <div className="rounded-xl border bg-card p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium">
                Lotação{" "}
                <span className="text-muted-foreground">
                  {confirmed}
                  {capacity != null ? ` / ${capacity}` : ""} confirmados
                </span>
                {waitlist > 0 && (
                  <Badge variant="secondary" className="ml-2">
                    {waitlist} na lista de espera
                  </Badge>
                )}
              </p>
              {occupancyPct != null && (
                <div className="mt-2 h-2 w-full max-w-md overflow-hidden rounded-full bg-muted">
                  <div
                    className={`h-full rounded-full transition-all ${
                      occupancyPct >= 100 ? "bg-destructive" : "bg-primary"
                    }`}
                    style={{ width: `${occupancyPct}%` }}
                  />
                </div>
              )}
            </div>
            {waitlist > 0 && (
              <Button
                size="sm"
                variant="outline"
                onClick={promoteWaitlist}
                disabled={promoting || (capacity != null && confirmed >= capacity)}
              >
                {promoting ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Users className="size-4" />
                )}
                Promover da espera
              </Button>
            )}
          </div>
        </div>
      )}

      <Tabs defaultValue="guests" className="gap-0">
        <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <TabsList variant="line" className="mb-5 h-auto gap-1 border-b">
            <TabsTrigger value="guests" className="px-3 py-2">
              <Users /> Convidados
            </TabsTrigger>
            <TabsTrigger value="envios" className="px-3 py-2">
              <Send /> Envios
            </TabsTrigger>
            <TabsTrigger value="payments" className="px-3 py-2">
              <CreditCard /> Pagamentos
            </TabsTrigger>
            <TabsTrigger value="operacao" className="px-3 py-2">
              <ScanLine /> Check-in
            </TabsTrigger>
            <TabsTrigger value="settings" className="px-3 py-2">
              <Settings2 /> Configurações
            </TabsTrigger>
            <TabsTrigger value="activity" className="px-3 py-2">
              <Activity /> Atividade
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="guests">
          <GuestsTab
            event={event}
            guests={guests}
            logs={logs}
            sessions={sessions}
            appBaseUrl={appBaseUrl}
            onChange={refresh}
          />
        </TabsContent>

        <TabsContent value="envios">
          <Segmented
            value={enviosView}
            onChange={setEnviosView}
            options={[
              { value: "qr", label: "Entrega do QR" },
              { value: "messages", label: "Mensagens" },
            ]}
          />
          {enviosView === "qr" ? (
            <QrDeliveryTab
              event={event}
              guests={guests}
              appBaseUrl={appBaseUrl}
              onChange={refresh}
            />
          ) : (
            <MessagesTab eventId={event.id} />
          )}
        </TabsContent>

        <TabsContent value="payments">
          <PaymentsTab eventId={event.id} />
        </TabsContent>

        <TabsContent value="operacao">
          <Segmented
            value={opView}
            onChange={setOpView}
            options={[
              { value: "checker", label: "Checker & Totem" },
              { value: "sessions", label: "Sessões" },
              { value: "flow", label: "Fluxo" },
            ]}
          />
          {opView === "checker" && (
            <CheckerTab event={event} appBaseUrl={appBaseUrl} />
          )}
          {opView === "sessions" && (
            <SessionsTab eventId={event.id} sessions={sessions} onChange={refresh} />
          )}
          {opView === "flow" && <FlowTab flow={flow} />}
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
