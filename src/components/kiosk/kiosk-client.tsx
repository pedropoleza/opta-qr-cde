"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Hit = {
  id: string;
  name: string;
  tier: string | null;
  vip: boolean;
  checkedIn: boolean;
};

type Done = {
  name?: string;
  result: string;
  movement?: string;
  token?: string;
  vip?: boolean;
};

export function KioskClient({
  token,
  eventName,
  active,
  brandName,
  logoUrl,
  primaryColor,
}: {
  token: string;
  eventName: string;
  active: boolean;
  brandName: string | null;
  logoUrl: string | null;
  primaryColor: string | null;
}) {
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [searching, setSearching] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [done, setDone] = useState<Done | null>(null);
  const brand = primaryColor || "#4f46e5";

  // Busca com debounce.
  useEffect(() => {
    if (query.trim().length < 3) {
      setHits([]);
      return;
    }
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/kiosk/${token}/search?q=${encodeURIComponent(query.trim())}`,
        );
        const data = await res.json();
        setHits(data.guests ?? []);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [query, token]);

  // Auto-reset depois de confirmar.
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function scheduleReset() {
    if (resetTimer.current) clearTimeout(resetTimer.current);
    resetTimer.current = setTimeout(() => {
      setDone(null);
      setQuery("");
      setHits([]);
    }, 6000);
  }

  async function checkIn(h: Hit) {
    setBusyId(h.id);
    try {
      const res = await fetch(`/api/kiosk/${token}/checkin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guestId: h.id }),
      });
      const data = await res.json();
      setDone({
        name: data.guestName ?? h.name,
        result: res.ok ? data.result : "error",
        movement: data.movement,
        token: data.token,
        vip: data.vip,
      });
      scheduleReset();
    } finally {
      setBusyId(null);
    }
  }

  if (!active) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-900 p-8 text-center text-white">
        <div>
          <h1 className="text-2xl font-bold">{eventName}</h1>
          <p className="mt-2 text-neutral-300">O totem está fechado no momento.</p>
        </div>
      </div>
    );
  }

  // Tela de confirmação.
  if (done) {
    const ok = done.result === "checked_in";
    const dup = done.result === "duplicate";
    return (
      <div
        className="flex min-h-screen flex-col items-center justify-center p-8 text-center text-white"
        style={{ backgroundColor: ok ? "#059669" : dup ? "#d97706" : "#dc2626" }}
        onClick={() => {
          setDone(null);
          setQuery("");
        }}
      >
        <p className="text-6xl font-black">
          {ok ? "✓" : dup ? "!" : "✕"}
        </p>
        {done.vip && ok && (
          <p className="mt-3 rounded-full bg-amber-400 px-4 py-1 text-lg font-bold text-amber-950">
            ⭐ VIP
          </p>
        )}
        <h1 className="mt-4 text-4xl font-black">{done.name}</h1>
        <p className="mt-3 text-2xl font-semibold">
          {ok ? "Check-in confirmado!" : dup ? "Você já fez check-in" : "Não encontrado"}
        </p>
        {ok && (
          <p className="mt-1 text-lg opacity-90">Seja bem-vindo(a)! 🎉</p>
        )}
        {ok && done.token && (
          <Button
            size="lg"
            variant="secondary"
            className="mt-8 text-lg"
            asChild
            onClick={(e) => e.stopPropagation()}
          >
            <a href={`/api/ticket/${done.token}/badge`} target="_blank" rel="noreferrer">
              Imprimir crachá
            </a>
          </Button>
        )}
        <p className="mt-10 text-sm opacity-80">Toque para o próximo</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center bg-neutral-50 p-6">
      <div className="flex w-full max-w-lg flex-col items-center pt-10 text-center">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt={brandName ?? "logo"} className="mb-3 h-10 object-contain" />
        ) : null}
        <h1 className="text-2xl font-bold" style={{ color: brand }}>
          {brandName || "Check-in"}
        </h1>
        <p className="text-neutral-500">{eventName}</p>

        <div className="mt-8 w-full">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 size-6 -translate-y-1/2 text-neutral-400" />
            <Input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Digite seu nome"
              className="h-16 rounded-2xl pl-14 text-xl shadow-sm"
            />
          </div>

          <div className="mt-4 space-y-2">
            {searching && (
              <div className="flex justify-center py-6 text-neutral-400">
                <Loader2 className="size-6 animate-spin" />
              </div>
            )}
            {!searching && query.trim().length >= 3 && hits.length === 0 && (
              <p className="py-6 text-neutral-400">
                Ninguém encontrado. Procure um organizador.
              </p>
            )}
            {hits.map((h) => (
              <button
                key={h.id}
                disabled={busyId === h.id}
                onClick={() => checkIn(h)}
                className="flex w-full items-center justify-between gap-3 rounded-2xl border bg-white p-5 text-left shadow-sm transition hover:border-neutral-300 active:scale-[0.99] disabled:opacity-60"
              >
                <span className="min-w-0">
                  <span className="flex items-center gap-2 text-lg font-semibold">
                    <span className="truncate">{h.name}</span>
                    {h.vip && (
                      <span className="rounded bg-amber-400 px-1.5 text-xs font-bold text-amber-950">
                        VIP
                      </span>
                    )}
                  </span>
                  {h.tier && <span className="text-sm text-neutral-500">{h.tier}</span>}
                </span>
                {busyId === h.id ? (
                  <Loader2 className="size-6 animate-spin text-neutral-400" />
                ) : h.checkedIn ? (
                  <span className="text-sm font-medium text-emerald-600">já entrou</span>
                ) : (
                  <span
                    className="rounded-full px-4 py-1.5 text-sm font-bold text-white"
                    style={{ backgroundColor: brand }}
                  >
                    Check-in
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
