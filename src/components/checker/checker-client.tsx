"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CheckerSuccess } from "@/components/checker/success-screen";
import type { Html5Qrcode } from "html5-qrcode";

// Checker Mode (Etapa 2 + melhorias): scan por câmera, busca por nome (#1),
// walk-in na porta (#2) e desfazer check-in (#6). Mobile-first, tela cheia.

type ScanResult = {
  result: "checked_in" | "duplicate" | "invalid" | "wrong_event";
  message: string;
  guestName?: string;
  guestTier?: string | null;
  checkedInAt?: string;
  capacityWarning?: boolean;
};

type GuestHit = {
  id: string;
  name: string;
  email: string | null;
  tier: string | null;
  groupSize: number;
  checkedIn: boolean;
  checkedInAt: string | null;
};

type Mode = "scan" | "manual" | "search" | "walkin";

const RESULT_STYLE: Record<ScanResult["result"], { bg: string; title: string }> = {
  checked_in: { bg: "bg-green-600", title: "ENTRADA LIBERADA" },
  duplicate: { bg: "bg-yellow-500", title: "JÁ FEZ CHECK-IN" },
  invalid: { bg: "bg-red-600", title: "QR CODE INVÁLIDO" },
  wrong_event: { bg: "bg-neutral-500", title: "OUTRO EVENTO" },
};

function parseQr(text: string): { token: string; sig: string } | null {
  try {
    const url = new URL(text);
    const token = url.searchParams.get("token");
    const sig = url.searchParams.get("sig");
    if (token && sig) return { token, sig };
  } catch {
    const parts = text.trim().split(".");
    if (parts.length === 2 && parts[0] && parts[1]) {
      return { token: parts[0], sig: parts[1] };
    }
  }
  return null;
}

export function CheckerClient({
  checkerToken,
  eventName,
  eventStatus,
}: {
  checkerToken: string;
  eventName: string;
  eventStatus: string;
}) {
  const [authorized, setAuthorized] = useState(false);
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState("");
  const [result, setResult] = useState<ScanResult | null>(null);
  const [mode, setMode] = useState<Mode>("scan");
  const [manualValue, setManualValue] = useState("");
  const [cameraError, setCameraError] = useState("");
  // Busca por nome
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<GuestHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  // Walk-in
  const [walkin, setWalkin] = useState({ name: "", email: "", tier: "" });
  const [walkinBusy, setWalkinBusy] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const busyRef = useRef(false);

  async function submitPin(e: React.FormEvent) {
    e.preventDefault();
    setPinError("");
    const res = await fetch("/api/checker/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: checkerToken, pin }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setPinError(data.error ?? "PIN inválido");
      return;
    }
    setAuthorized(true);
  }

  const validate = useCallback(async (raw: string) => {
    if (busyRef.current) return;
    busyRef.current = true;
    const parsed = parseQr(raw);
    if (!parsed) {
      setResult({ result: "invalid", message: "Conteúdo do QR não reconhecido" });
      busyRef.current = false;
      return;
    }
    try {
      const res = await fetch("/api/checkin/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: parsed.token,
          sig: parsed.sig,
          deviceInfo: navigator.userAgent,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setResult({ result: "invalid", message: data.error ?? "Erro na validação" });
      } else {
        setResult(data as ScanResult);
      }
    } catch {
      setResult({ result: "invalid", message: "Falha de rede — tente novamente" });
    } finally {
      busyRef.current = false;
    }
  }, []);

  const search = useCallback(async (q: string) => {
    setSearching(true);
    try {
      const res = await fetch(`/api/checker/guests?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      if (res.ok) setHits(data.guests ?? []);
    } catch {
      /* ignora */
    } finally {
      setSearching(false);
    }
  }, []);

  // Busca (debounce) no modo busca.
  useEffect(() => {
    if (!authorized || mode !== "search") return;
    const t = setTimeout(() => search(query.trim()), 350);
    return () => clearTimeout(t);
  }, [authorized, mode, query, search]);

  async function checkInGuest(g: GuestHit) {
    setBusyId(g.id);
    const group = g.groupSize > 1;
    const res = await fetch(
      group ? "/api/checker/checkin-group" : "/api/checker/checkin",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guestId: g.id }),
      },
    );
    const data = await res.json().catch(() => ({}));
    setBusyId(null);
    if (!res.ok) {
      toast.error(data.error ?? "Erro no check-in");
      return;
    }
    setResult(data as ScanResult);
  }

  async function undoGuest(g: GuestHit) {
    setBusyId(g.id);
    const res = await fetch("/api/checker/undo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ guestId: g.id }),
    });
    const data = await res.json().catch(() => ({}));
    setBusyId(null);
    if (!res.ok) {
      toast.error(data.error ?? "Erro ao desfazer");
      return;
    }
    toast.success(`Check-in de ${g.name} desfeito`);
    search(query.trim());
  }

  async function submitWalkin(e: React.FormEvent) {
    e.preventDefault();
    if (!walkin.name.trim()) return;
    setWalkinBusy(true);
    const res = await fetch("/api/checker/walkin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(walkin),
    });
    const data = await res.json().catch(() => ({}));
    setWalkinBusy(false);
    if (!res.ok) {
      toast.error(data.error ?? "Erro ao cadastrar");
      return;
    }
    setWalkin({ name: "", email: "", tier: "" });
    setResult(data as ScanResult);
  }

  function closeResult() {
    setResult(null);
    if (mode === "search") search(query.trim());
  }

  // Scanner html5-qrcode em tela cheia (apenas no modo scan).
  useEffect(() => {
    if (!authorized || result || mode !== "scan") return;
    let cancelled = false;
    let instance: Html5Qrcode | null = null;

    (async () => {
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        if (cancelled) return;
        instance = new Html5Qrcode("qr-reader");
        scannerRef.current = instance;
        await instance.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          (decodedText) => {
            instance?.pause(true);
            validate(decodedText);
          },
          () => {},
        );
      } catch {
        if (!cancelled) {
          setCameraError(
            "Não foi possível acessar a câmera. Use a busca por nome ou o código manual.",
          );
        }
      }
    })();

    return () => {
      cancelled = true;
      const s = instance;
      if (s) {
        s.stop()
          .catch(() => {})
          .finally(() => {
            try {
              s.clear();
            } catch {}
          });
      }
      scannerRef.current = null;
    };
  }, [authorized, result, mode, validate]);

  if (!authorized) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-neutral-900 p-6 text-white">
        <h1 className="mb-1 text-xl font-bold">Spark Check-in</h1>
        <p className="mb-6 text-center text-neutral-300">{eventName}</p>
        <form onSubmit={submitPin} className="w-full max-w-xs space-y-4">
          <Input
            type="tel"
            inputMode="numeric"
            maxLength={6}
            placeholder="PIN de 6 dígitos"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            className="bg-white text-center font-mono text-2xl tracking-widest text-black"
            autoFocus
          />
          {pinError && <p className="text-center text-sm text-red-400">{pinError}</p>}
          <Button type="submit" className="w-full" size="lg">
            Entrar no modo Checker
          </Button>
        </form>
      </div>
    );
  }

  if (result && result.result === "checked_in") {
    return (
      <CheckerSuccess
        guestName={result.guestName}
        guestTier={result.guestTier}
        checkedInAt={result.checkedInAt}
        capacityWarning={result.capacityWarning}
        onNext={closeResult}
      />
    );
  }

  if (result) {
    const style = RESULT_STYLE[result.result];
    return (
      <div
        className={`flex min-h-screen flex-col items-center justify-center p-6 text-white ${style.bg}`}
      >
        <p className="text-5xl font-black">{style.title}</p>
        {result.guestName && (
          <p className="mt-4 text-2xl font-semibold">{result.guestName}</p>
        )}
        {result.guestTier && (
          <span className="mt-2 rounded-full bg-white/90 px-3 py-1 text-sm font-bold tracking-wide text-neutral-900 uppercase">
            {result.guestTier}
          </span>
        )}
        {result.checkedInAt && (
          <p className="mt-1 text-lg opacity-90">
            {result.result === "duplicate" ? "1º check-in: " : ""}
            {new Date(result.checkedInAt).toLocaleTimeString("pt-BR")}
          </p>
        )}
        <p className="mt-2 opacity-90">{result.message}</p>
        {result.capacityWarning && (
          <p className="mt-4 rounded-md bg-black/30 px-4 py-2 font-semibold">
            ⚠ Capacidade do evento atingida
          </p>
        )}
        <Button
          size="lg"
          variant="secondary"
          className="mt-10 w-full max-w-xs text-lg"
          onClick={closeResult}
        >
          Continuar
        </Button>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-neutral-900 text-white">
      <header className="flex items-center justify-between p-4">
        <div>
          <p className="text-sm text-neutral-400">Checker</p>
          <p className="font-semibold">{eventName}</p>
        </div>
        {eventStatus !== "active" && (
          <span className="rounded bg-amber-500 px-2 py-1 text-xs font-bold text-black">
            EVENTO NÃO ATIVO
          </span>
        )}
      </header>

      {/* Seletor de modo */}
      <div className="flex gap-1 px-4 pb-2">
        {([
          ["scan", "Câmera"],
          ["search", "Buscar nome"],
          ["walkin", "Walk-in"],
          ["manual", "Código"],
        ] as [Mode, string][]).map(([m, label]) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`flex-1 rounded-md px-2 py-1.5 text-sm font-medium transition-colors ${
              mode === m
                ? "bg-white text-neutral-900"
                : "bg-neutral-800 text-neutral-300"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {mode === "scan" && (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 p-4">
          <div id="qr-reader" className="w-full max-w-sm overflow-hidden rounded-lg" />
          {cameraError && (
            <p className="text-center text-sm text-amber-400">{cameraError}</p>
          )}
        </div>
      )}

      {mode === "manual" && (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6">
          <p className="text-center text-neutral-300">
            Cole o link do QR Code ou digite token.assinatura
          </p>
          <Input
            value={manualValue}
            onChange={(e) => setManualValue(e.target.value)}
            placeholder="https://.../checkin/validate?token=...&sig=..."
            className="bg-white text-black"
          />
          <Button
            size="lg"
            className="w-full max-w-xs"
            onClick={() => {
              if (manualValue.trim()) validate(manualValue.trim());
            }}
          >
            Validar
          </Button>
        </div>
      )}

      {mode === "search" && (
        <div className="flex flex-1 flex-col gap-3 p-4">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nome ou e-mail"
            className="bg-white text-black"
            autoFocus
          />
          <div className="flex-1 space-y-2 overflow-y-auto">
            {searching && (
              <p className="py-4 text-center text-sm text-neutral-400">Buscando…</p>
            )}
            {!searching && query.trim() && hits.length === 0 && (
              <p className="py-4 text-center text-sm text-neutral-400">
                Nenhum convidado encontrado.
              </p>
            )}
            {hits.map((g) => (
              <div
                key={g.id}
                className="flex items-center justify-between gap-3 rounded-lg bg-neutral-800 p-3"
              >
                <div className="min-w-0">
                  <p className="flex items-center gap-2 truncate font-medium">
                    {g.name}
                    {g.tier && (
                      <span className="rounded bg-amber-400/20 px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-amber-300 uppercase">
                        {g.tier}
                      </span>
                    )}
                    {g.groupSize > 1 && (
                      <span className="rounded bg-neutral-700 px-1.5 py-0.5 text-[10px] font-bold text-neutral-200">
                        GRUPO {g.groupSize}
                      </span>
                    )}
                  </p>
                  {g.email && (
                    <p className="truncate text-xs text-neutral-400">{g.email}</p>
                  )}
                </div>
                {g.checkedIn ? (
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="rounded bg-green-600 px-2 py-1 text-xs font-bold">
                      PRESENTE
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-neutral-300"
                      disabled={busyId === g.id}
                      onClick={() => undoGuest(g)}
                    >
                      Desfazer
                    </Button>
                  </div>
                ) : (
                  <Button
                    size="sm"
                    className="shrink-0"
                    disabled={busyId === g.id}
                    onClick={() => checkInGuest(g)}
                  >
                    {g.groupSize > 1 ? `Check-in grupo (${g.groupSize})` : "Check-in"}
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {mode === "walkin" && (
        <form
          onSubmit={submitWalkin}
          className="flex flex-1 flex-col items-center justify-center gap-3 p-6"
        >
          <p className="text-center text-neutral-300">
            Cadastrar convidado na porta e dar entrada
          </p>
          <Input
            value={walkin.name}
            onChange={(e) => setWalkin((w) => ({ ...w, name: e.target.value }))}
            placeholder="Nome"
            className="bg-white text-black"
            autoFocus
            required
          />
          <Input
            type="email"
            value={walkin.email}
            onChange={(e) => setWalkin((w) => ({ ...w, email: e.target.value }))}
            placeholder="E-mail (opcional)"
            className="bg-white text-black"
          />
          <Input
            value={walkin.tier}
            onChange={(e) => setWalkin((w) => ({ ...w, tier: e.target.value }))}
            placeholder="Categoria (opcional: VIP…)"
            className="bg-white text-black"
          />
          <Button type="submit" size="lg" className="w-full max-w-xs" disabled={walkinBusy}>
            {walkinBusy ? "Cadastrando..." : "Cadastrar e dar entrada"}
          </Button>
        </form>
      )}
    </div>
  );
}
