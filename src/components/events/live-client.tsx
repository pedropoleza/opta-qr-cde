"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Radio, TrendingUp, UserCheck, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

type Live = {
  checkedIn: number;
  totalGuests: number;
  capacity: number | null;
  last10min: number;
  ratePerMin: number;
  recent: { name: string; at: string }[];
  updatedAt: string;
};

export function LiveClient({
  eventId,
  eventName,
}: {
  eventId: string;
  eventName: string;
}) {
  const [data, setData] = useState<Live | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/events/${eventId}/live`, {
        cache: "no-store",
      });
      if (res.ok) setData(await res.json());
    } catch {
      /* mantém o último estado */
    }
  }, [eventId]);

  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [load]);

  const pct =
    data && data.totalGuests > 0
      ? Math.round((data.checkedIn / data.totalGuests) * 100)
      : 0;
  const occupancy =
    data && data.capacity
      ? Math.round((data.checkedIn / data.capacity) * 100)
      : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            href={`/events/${eventId}`}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Voltar ao evento"
          >
            <ArrowLeft className="size-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{eventName}</h1>
            <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Radio className="size-3.5 animate-pulse text-success" /> Painel ao
              vivo · atualiza a cada 5s
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardContent className="flex flex-col items-center justify-center gap-2 py-10">
            <span className="flex items-center gap-2 text-sm font-medium tracking-widest text-muted-foreground uppercase">
              <UserCheck className="size-4" /> Presentes
            </span>
            <p className="text-7xl font-black tracking-tight tabular-nums">
              {data?.checkedIn ?? "—"}
              <span className="text-3xl text-muted-foreground">
                {" "}
                / {data?.totalGuests ?? "—"}
              </span>
            </p>
            <div className="mt-2 h-3 w-full max-w-md overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-success transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="text-sm text-muted-foreground">
              {pct}% de comparecimento
              {occupancy != null ? ` · ${occupancy}% da capacidade` : ""}
            </p>
          </CardContent>
        </Card>

        <div className="grid gap-4">
          <Card>
            <CardContent className="flex flex-col gap-1 py-6">
              <span className="flex items-center gap-1.5 text-xs tracking-widest text-muted-foreground uppercase">
                <TrendingUp className="size-3.5" /> Últimos 10 min
              </span>
              <p className="text-4xl font-bold tabular-nums">
                {data?.last10min ?? "—"}
              </p>
              <p className="text-xs text-muted-foreground">
                ~{data?.ratePerMin ?? 0}/min de chegada
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex flex-col gap-1 py-6">
              <span className="flex items-center gap-1.5 text-xs tracking-widest text-muted-foreground uppercase">
                <Users className="size-3.5" /> Faltam chegar
              </span>
              <p className="text-4xl font-bold tabular-nums">
                {data ? Math.max(0, data.totalGuests - data.checkedIn) : "—"}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardContent className="py-5">
          <p className="mb-3 text-sm font-medium text-muted-foreground">
            Últimas entradas
          </p>
          {!data || data.recent.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Aguardando o primeiro check-in…
            </p>
          ) : (
            <ul className="divide-y">
              {data.recent.map((r, i) => (
                <li
                  key={`${r.at}-${i}`}
                  className="flex items-center justify-between py-2.5"
                >
                  <span className="font-medium">{r.name}</span>
                  <span className="text-sm text-muted-foreground tabular-nums">
                    {new Date(r.at).toLocaleTimeString("pt-BR")}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
