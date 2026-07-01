"use client";

import { useMemo, useState } from "react";
import {
  ScanLine,
  CheckCircle2,
  RefreshCw,
  XCircle,
  AlertTriangle,
  Undo2,
  Search,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { Segmented } from "@/components/ui/segmented";
import type { LogRow } from "@/components/events/event-detail";

const META: Record<
  string,
  { label: string; icon: React.ComponentType<{ className?: string }>; tone: string; dot: string }
> = {
  checked_in: { label: "Check-in confirmado", icon: CheckCircle2, tone: "bg-emerald-500/15 text-emerald-600", dot: "bg-emerald-500" },
  reentry: { label: "Reentrada", icon: RefreshCw, tone: "bg-amber-500/15 text-amber-600", dot: "bg-amber-500" },
  duplicate: { label: "Scan duplicado", icon: RefreshCw, tone: "bg-amber-500/15 text-amber-600", dot: "bg-amber-500" },
  invalid: { label: "QR inválido", icon: XCircle, tone: "bg-rose-500/15 text-rose-600", dot: "bg-rose-500" },
  wrong_event: { label: "Outro evento", icon: AlertTriangle, tone: "bg-orange-500/15 text-orange-600", dot: "bg-orange-500" },
  undo: { label: "Check-in desfeito", icon: Undo2, tone: "bg-muted text-muted-foreground", dot: "bg-muted-foreground" },
};

const FILTERS = [
  { value: "all", label: "Tudo" },
  { value: "checked_in", label: "Check-ins" },
  { value: "issues", label: "Problemas" },
];

export function ActivityTab({ logs }: { logs: LogRow[] }) {
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return logs.filter((l) => {
      const okFilter =
        filter === "all"
          ? true
          : filter === "checked_in"
            ? ["checked_in", "reentry"].includes(l.status)
            : ["duplicate", "invalid", "wrong_event"].includes(l.status);
      const okQuery = !q || (l.guestName ?? "").toLowerCase().includes(q);
      return okFilter && okQuery;
    });
  }, [logs, filter, query]);

  return (
    <div className="space-y-4 pt-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented value={filter} onChange={setFilter} options={FILTERS} className="mb-0" />
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por convidado"
            className="h-9 w-56 pl-8 text-sm"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border bg-card">
          <EmptyState
            icon={ScanLine}
            title={query || filter !== "all" ? "Nada por aqui" : "Nenhuma atividade ainda"}
            description="Check-ins, reentradas e tentativas aparecem nesta linha do tempo assim que o Checker começar a escanear."
          />
        </div>
      ) : (
        <div className="rounded-xl border bg-card p-2 sm:p-4">
          <ol className="relative">
            {filtered.map((log, i) => {
              const m = META[log.status] ?? META.undo;
              const Icon = m.icon;
              const last = i === filtered.length - 1;
              return (
                <li key={log.id} className="relative flex gap-3 pb-4 last:pb-0">
                  {!last && <span className="absolute left-[15px] top-9 h-full w-px bg-border" />}
                  <span className={`flex size-8 shrink-0 items-center justify-center rounded-full ${m.tone}`}>
                    <Icon className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1 rounded-lg px-2 py-1 transition hover:bg-muted/40">
                    <div className="flex flex-wrap items-center gap-x-2">
                      <span className="text-sm font-medium">{m.label}</span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(log.scannedAt).toLocaleString("pt-BR")}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {log.guestName ?? "—"}
                      {log.gate ? ` · ${log.gate}` : ""}
                      {log.message ? ` · ${log.message}` : ""}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </div>
  );
}
