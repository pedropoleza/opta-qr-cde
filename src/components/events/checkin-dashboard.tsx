"use client";

import { useMemo, useState } from "react";
import {
  Users,
  CheckCircle2,
  Clock,
  UserX,
  QrCode,
  DoorOpen,
  Search,
  TrendingUp,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import type { GuestRow, LogRow } from "@/components/events/event-detail";

type Report = {
  guests: number;
  checkedIn: number;
  noShow: number;
  insideNow: number;
  qrGenerated: number;
};
type CurvePoint = { label: string; count: number };

const SCAN_OK = new Set(["checked_in", "reentry"]);

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}
function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}
function methodOf(l: LogRow): { label: string; icon: React.ReactNode } {
  switch (l.method) {
    case "manual":
      return { label: "Manual", icon: <DoorOpen className="size-3.5" /> };
    case "kiosk":
      return { label: "Totem", icon: <DoorOpen className="size-3.5" /> };
    case "qr":
    default:
      return { label: "QR Code", icon: <QrCode className="size-3.5" /> };
  }
}

// ---- Métrica ----
function Metric({
  icon,
  tone,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  tone: string;
  label: string;
  value: number | string;
  hint?: string;
}) {
  return (
    <Card className="transition hover:shadow-sm">
      <CardContent className="flex items-start gap-3.5 p-5">
        <span className={`flex size-11 shrink-0 items-center justify-center rounded-xl ${tone}`}>
          {icon}
        </span>
        <div className="min-w-0">
          <p className="text-[1.7rem] font-bold leading-none tracking-tight">{value}</p>
          <p className="mt-1 text-sm font-medium">{label}</p>
          {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

export function CheckinDashboard({
  eventName,
  report,
  curve,
  logs,
  guests,
}: {
  eventName: string;
  report: Report;
  curve: CurvePoint[];
  logs: LogRow[];
  guests: GuestRow[];
}) {
  const [query, setQuery] = useState("");
  const [detail, setDetail] = useState<string | null>(null); // guestId

  const total = report.guests;
  const confirmed = report.checkedIn;
  const noShow = report.noShow;
  const pending = Math.max(0, total - confirmed - noShow);
  const pct = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0);

  const guestById = useMemo(() => {
    const m = new Map<string, GuestRow>();
    for (const g of guests) m.set(g.id, g);
    return m;
  }, [guests]);

  const checkins = useMemo(
    () => logs.filter((l) => SCAN_OK.has(l.status)),
    [logs],
  );
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return checkins;
    return checkins.filter((l) => {
      const g = l.guestId ? guestById.get(l.guestId) : undefined;
      return (
        (l.guestName ?? "").toLowerCase().includes(q) ||
        (g?.email ?? "").toLowerCase().includes(q) ||
        (g?.phone ?? "").toLowerCase().includes(q)
      );
    });
  }, [checkins, query, guestById]);

  const maxCount = Math.max(1, ...curve.map((c) => c.count));
  const detailGuest = detail ? guestById.get(detail) : undefined;
  const detailLogs = detail ? logs.filter((l) => l.guestId === detail) : [];

  return (
    <div className="space-y-6 pt-4">
      {/* Métricas */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Metric
          icon={<Users className="size-5" />}
          tone="bg-primary/10 text-primary"
          label="Convidados"
          value={total}
          hint={`${report.qrGenerated} com QR gerado`}
        />
        <Metric
          icon={<CheckCircle2 className="size-5" />}
          tone="bg-emerald-500/15 text-emerald-600"
          label="Check-in confirmado"
          value={confirmed}
          hint={`${pct(confirmed)}% do total`}
        />
        <Metric
          icon={<Clock className="size-5" />}
          tone="bg-amber-500/15 text-amber-600"
          label="Pendentes"
          value={pending}
          hint={`${pct(pending)}% aguardando`}
        />
        <Metric
          icon={<UserX className="size-5" />}
          tone="bg-rose-500/15 text-rose-600"
          label="Ausentes (no-show)"
          value={noShow}
          hint={report.insideNow ? `${report.insideNow} dentro agora` : undefined}
        />
      </div>

      {/* Comparação confirmados / pendentes / ausentes */}
      <Card>
        <CardContent className="space-y-3 p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Presença</p>
            <span className="text-xs text-muted-foreground">{total} convidados</span>
          </div>
          <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
            <div className="bg-emerald-500 transition-all" style={{ width: `${pct(confirmed)}%` }} />
            <div className="bg-amber-400 transition-all" style={{ width: `${pct(pending)}%` }} />
            <div className="bg-rose-500 transition-all" style={{ width: `${pct(noShow)}%` }} />
          </div>
          <div className="flex flex-wrap gap-4 text-xs">
            <Legend color="bg-emerald-500" label="Confirmados" value={confirmed} />
            <Legend color="bg-amber-400" label="Pendentes" value={pending} />
            <Legend color="bg-rose-500" label="Ausentes" value={noShow} />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        {/* Gráfico de check-ins por horário */}
        <Card>
          <CardContent className="p-5">
            <div className="mb-4 flex items-center gap-2">
              <TrendingUp className="size-4 text-muted-foreground" />
              <p className="text-sm font-medium">Check-ins por horário</p>
            </div>
            {curve.length === 0 ? (
              <div className="flex h-40 flex-col items-center justify-center rounded-lg border border-dashed text-center text-sm text-muted-foreground">
                <QrCode className="mb-2 size-6 opacity-40" />
                Nenhum check-in ainda. Os picos de entrada aparecem aqui.
              </div>
            ) : (
              <div className="flex h-44 items-end gap-1.5">
                {curve.map((c, i) => (
                  <div key={i} className="group flex flex-1 flex-col items-center justify-end gap-1">
                    <span className="text-[10px] font-medium text-muted-foreground opacity-0 transition group-hover:opacity-100">
                      {c.count}
                    </span>
                    <div
                      className="w-full rounded-t-md bg-primary/80 transition-all duration-200 hover:bg-primary"
                      style={{ height: `${Math.max(4, (c.count / maxCount) * 100)}%` }}
                      title={`${c.label} · ${c.count} check-in(s)`}
                    />
                    <span className="text-[10px] text-muted-foreground">{c.label}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Últimos check-ins */}
        <Card>
          <CardContent className="p-5">
            <p className="mb-3 text-sm font-medium">Últimos check-ins</p>
            {checkins.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Ninguém entrou ainda.
              </p>
            ) : (
              <ul className="space-y-2">
                {checkins.slice(0, 7).map((l) => (
                  <li key={l.id} className="flex items-center gap-3">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600">
                      <CheckCircle2 className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">
                        {l.guestName ?? "Convidado"}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {fmtTime(l.scannedAt)}
                        {l.gate ? ` · ${l.gate}` : ""}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Histórico detalhado */}
      <Card>
        <CardContent className="p-0">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
            <div>
              <p className="text-sm font-medium">Histórico de confirmações</p>
              <p className="text-xs text-muted-foreground">
                Horário exato, método e operador de cada check-in.
              </p>
            </div>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar por nome, e-mail ou telefone"
                className="h-9 w-64 pl-8 text-sm"
              />
            </div>
          </div>

          {filtered.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              {query ? "Nada encontrado para a busca." : "Nenhuma confirmação registrada ainda."}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-2.5 font-medium">Pessoa</th>
                    <th className="px-4 py-2.5 font-medium">Data e horário</th>
                    <th className="px-4 py-2.5 font-medium">Método</th>
                    <th className="px-4 py-2.5 font-medium">Porta / Operador</th>
                    <th className="px-4 py-2.5 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((l) => {
                    const g = l.guestId ? guestById.get(l.guestId) : undefined;
                    const m = methodOf(l);
                    return (
                      <tr
                        key={l.id}
                        onClick={() => l.guestId && setDetail(l.guestId)}
                        className="cursor-pointer border-b transition last:border-0 hover:bg-muted/40"
                      >
                        <td className="px-4 py-2.5">
                          <span className="block font-medium">{l.guestName ?? "Convidado"}</span>
                          {g?.email && (
                            <span className="block text-xs text-muted-foreground">{g.email}</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 tabular-nums">{fmtDateTime(l.scannedAt)}</td>
                        <td className="px-4 py-2.5">
                          <span className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2 py-0.5 text-xs">
                            {m.icon} {m.label}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-muted-foreground">{l.gate ?? "—"}</td>
                        <td className="px-4 py-2.5">
                          <Badge
                            className={
                              l.status === "reentry"
                                ? "border-transparent bg-amber-500/15 text-amber-700"
                                : "border-transparent bg-emerald-500/15 text-emerald-700"
                            }
                          >
                            {l.status === "reentry" ? "Reentrada" : "Confirmado"}
                          </Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Drawer: histórico individual do contato */}
      <Drawer open={detail !== null} onOpenChange={(o) => !o && setDetail(null)}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>{detailGuest?.name ?? "Convidado"}</DrawerTitle>
            <DrawerDescription>Histórico de check-in — {eventName}</DrawerDescription>
          </DrawerHeader>
          <DrawerBody className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <Field label="E-mail" value={detailGuest?.email ?? "—"} />
              <Field label="Telefone" value={detailGuest?.phone ?? "—"} />
              <Field label="QR / Ingresso" value={detailGuest?.ticketToken ? `${detailGuest.ticketToken.slice(0, 12)}…` : "—"} />
              <Field label="Categoria" value={detailGuest?.tier ?? "—"} />
            </div>
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Eventos deste contato
              </p>
              {detailLogs.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sem registros carregados.</p>
              ) : (
                <ul className="space-y-2">
                  {detailLogs.map((l) => {
                    const m = methodOf(l);
                    return (
                      <li key={l.id} className="flex items-center gap-3 rounded-lg border p-2.5">
                        <span className="flex size-8 items-center justify-center rounded-full bg-muted">
                          {m.icon}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-medium">{fmtDateTime(l.scannedAt)}</span>
                          <span className="block text-xs text-muted-foreground">
                            {m.label}
                            {l.gate ? ` · ${l.gate}` : ""}
                            {l.message ? ` · ${l.message}` : ""}
                          </span>
                        </span>
                        <Badge variant="outline" className="text-xs">{l.status}</Badge>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </DrawerBody>
        </DrawerContent>
      </Drawer>
    </div>
  );
}

function Legend({ color, label, value }: { color: string; label: string; value: number }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`size-2.5 rounded-full ${color}`} />
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </span>
  );
}
function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="truncate font-medium">{value}</p>
    </div>
  );
}
