"use client";

import { DoorOpen, TrendingUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";

export type FlowData = {
  nps: {
    responses: number;
    nps: number;
    promoters: number;
    detractors: number;
    neutrals: number;
  };
  gates: { gate: string; count: number }[];
  curve: { label: string; count: number }[];
};

export function FlowTab({ flow }: { flow: FlowData }) {
  const totalEntries = flow.gates.reduce((s, g) => s + g.count, 0);
  const nps = flow.nps;
  const maxGate = Math.max(1, ...flow.gates.map((g) => g.count));
  const maxCurve = Math.max(1, ...flow.curve.map((c) => c.count));
  const peak = flow.curve.reduce(
    (best, c) => (c.count > best.count ? c : best),
    { label: "—", count: 0 },
  );

  if (totalEntries === 0 && nps.responses === 0) {
    return (
      <EmptyState
        icon={TrendingUp}
        title="Sem dados de fluxo ainda"
        description="As métricas aparecem conforme os check-ins acontecem. Dê um nome ao ponto/porta na tela do Checker para comparar entradas."
      />
    );
  }

  return (
    <div className="space-y-5 pt-2">
      {nps.responses > 0 && (
        <Card>
          <CardContent className="space-y-4 p-5">
            <div className="flex items-center justify-between">
              <p className="font-medium">Satisfação (NPS)</p>
              <span
                className={`text-2xl font-black ${
                  nps.nps >= 50 ? "text-success" : nps.nps >= 0 ? "text-amber-500" : "text-destructive"
                }`}
              >
                {nps.nps > 0 ? "+" : ""}
                {nps.nps}
              </span>
            </div>
            <div className="flex h-2 overflow-hidden rounded-full bg-muted">
              <div className="bg-success" style={{ width: `${(nps.promoters / nps.responses) * 100}%` }} />
              <div className="bg-amber-400" style={{ width: `${(nps.neutrals / nps.responses) * 100}%` }} />
              <div className="bg-destructive" style={{ width: `${(nps.detractors / nps.responses) * 100}%` }} />
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Promotores {nps.promoters}</span>
              <span>Neutros {nps.neutrals}</span>
              <span>Detratores {nps.detractors}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              {nps.responses} resposta(s).
            </p>
          </CardContent>
        </Card>
      )}

      {totalEntries > 0 && (
      <>
      <Card>
        <CardContent className="space-y-4 p-5">
          <div className="flex items-center gap-2">
            <DoorOpen className="size-4 text-muted-foreground" />
            <p className="font-medium">Entradas por porta</p>
          </div>
          <ul className="space-y-3">
            {flow.gates.map((g) => (
              <li key={g.gate} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{g.gate}</span>
                  <span className="text-muted-foreground">
                    {g.count} ({Math.round((g.count / totalEntries) * 100)}%)
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${(g.count / maxGate) * 100}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="size-4 text-muted-foreground" />
              <p className="font-medium">Curva de chegada</p>
            </div>
            <p className="text-sm text-muted-foreground">
              Pico: <strong className="text-foreground">{peak.label}</strong> ({peak.count})
            </p>
          </div>
          <div className="flex h-40 items-end gap-1 overflow-x-auto">
            {flow.curve.map((c, i) => (
              <div key={i} className="flex min-w-6 flex-1 flex-col items-center gap-1">
                <div
                  className="w-full rounded-t bg-primary/80"
                  style={{ height: `${(c.count / maxCurve) * 100}%` }}
                  title={`${c.label}: ${c.count}`}
                />
                <span className="whitespace-nowrap text-[10px] text-muted-foreground">
                  {c.label}
                </span>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Cada barra = janela de 15 minutos (entradas e reentradas).
          </p>
        </CardContent>
      </Card>
      </>
      )}
    </div>
  );
}
