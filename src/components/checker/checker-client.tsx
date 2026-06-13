"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Html5Qrcode } from "html5-qrcode";

// Checker Mode (Etapa 2): mobile-first, tela cheia, resposta em menos de 2s.
// Cores (seção 2.3): verde = check-in ok; amarelo = já usado; vermelho =
// inválido; cinza = ticket de outro evento.

type ScanResult = {
  result: "checked_in" | "duplicate" | "invalid" | "wrong_event";
  message: string;
  guestName?: string;
  checkedInAt?: string;
  capacityWarning?: boolean;
};

const RESULT_STYLE: Record<ScanResult["result"], { bg: string; title: string }> = {
  checked_in: { bg: "bg-green-600", title: "ENTRADA LIBERADA" },
  duplicate: { bg: "bg-yellow-500", title: "JÁ FEZ CHECK-IN" },
  invalid: { bg: "bg-red-600", title: "QR CODE INVÁLIDO" },
  wrong_event: { bg: "bg-neutral-500", title: "OUTRO EVENTO" },
};

function parseQr(text: string): { token: string; sig: string } | null {
  // O QR contém a URL {APP_BASE_URL}/checkin/validate?token=...&sig=... (seção 2.4)
  try {
    const url = new URL(text);
    const token = url.searchParams.get("token");
    const sig = url.searchParams.get("sig");
    if (token && sig) return { token, sig };
  } catch {
    // Campo manual alternativo: aceitar "token.sig" colado direto
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
  const [manualValue, setManualValue] = useState("");
  const [showManual, setShowManual] = useState(false);
  const [cameraError, setCameraError] = useState("");
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

  // Scanner html5-qrcode em tela cheia após autorização.
  useEffect(() => {
    if (!authorized || result || showManual) return;
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
          () => {}
        );
      } catch {
        if (!cancelled) {
          setCameraError(
            "Não foi possível acessar a câmera. Use o campo manual abaixo."
          );
        }
      }
    })();

    return () => {
      cancelled = true;
      const s = instance;
      if (s) {
        s.stop().catch(() => {}).finally(() => {
          try {
            s.clear();
          } catch {}
        });
      }
      scannerRef.current = null;
    };
  }, [authorized, result, showManual, validate]);

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

  // Tela de resultado em cor cheia — decisão em menos de 2 segundos.
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
          onClick={() => setResult(null)}
        >
          Escanear próximo
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

      {showManual ? (
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
          <Button
            variant="ghost"
            className="text-neutral-300"
            onClick={() => setShowManual(false)}
          >
            Voltar para a câmera
          </Button>
        </div>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 p-4">
          <div id="qr-reader" className="w-full max-w-sm overflow-hidden rounded-lg" />
          {cameraError && (
            <p className="text-center text-sm text-amber-400">{cameraError}</p>
          )}
          <Button
            variant="outline"
            className="border-neutral-600 bg-transparent text-white"
            onClick={() => setShowManual(true)}
          >
            Digitar código manualmente
          </Button>
        </div>
      )}
    </div>
  );
}
