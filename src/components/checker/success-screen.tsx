"use client";

import { Button } from "@/components/ui/button";

// Confetes leves (CSS puro). Posições/atrasos pré-definidos para parecer natural.
const CONFETTI = [
  { left: "8%", delay: "0s", dur: "2.6s", color: "#fde047", size: 9 },
  { left: "18%", delay: "0.5s", dur: "3.1s", color: "#ffffff", size: 7 },
  { left: "28%", delay: "0.2s", dur: "2.9s", color: "#a7f3d0", size: 10 },
  { left: "38%", delay: "0.8s", dur: "3.3s", color: "#fda4af", size: 8 },
  { left: "47%", delay: "0.1s", dur: "2.7s", color: "#fde047", size: 11 },
  { left: "56%", delay: "0.6s", dur: "3.2s", color: "#ffffff", size: 7 },
  { left: "64%", delay: "0.3s", dur: "2.8s", color: "#a7f3d0", size: 9 },
  { left: "72%", delay: "0.9s", dur: "3.0s", color: "#93c5fd", size: 8 },
  { left: "82%", delay: "0.15s", dur: "3.4s", color: "#fde047", size: 10 },
  { left: "90%", delay: "0.7s", dur: "2.9s", color: "#ffffff", size: 7 },
  { left: "13%", delay: "1.1s", dur: "3.2s", color: "#a7f3d0", size: 8 },
  { left: "60%", delay: "1.2s", dur: "3.5s", color: "#fda4af", size: 9 },
];

// UI profissional de confirmação ao ler o QR: checkmark animado, anéis de pulso,
// confetes e agradecimento ao convidado. Tela cheia, mobile-first.
export function CheckerSuccess({
  guestName,
  checkedInAt,
  capacityWarning,
  onNext,
}: {
  guestName?: string;
  checkedInAt?: string;
  capacityWarning?: boolean;
  onNext: () => void;
}) {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-gradient-to-b from-emerald-500 to-emerald-700 p-6 text-center text-white">
      {/* Confetes */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        {CONFETTI.map((c, i) => (
          <span
            key={i}
            className="spark-confetti absolute top-0 rounded-[2px]"
            style={{
              left: c.left,
              width: c.size,
              height: c.size * 1.6,
              backgroundColor: c.color,
              animationDelay: c.delay,
              animationDuration: c.dur,
            }}
          />
        ))}
      </div>

      {/* Anéis de pulso + checkmark */}
      <div className="relative mb-8 flex items-center justify-center">
        <span className="spark-ring absolute size-28 rounded-full bg-white/30" />
        <span
          className="spark-ring absolute size-28 rounded-full bg-white/20"
          style={{ animationDelay: "0.5s" }}
        />
        <div className="spark-pop relative flex size-28 items-center justify-center rounded-full bg-white shadow-2xl">
          <svg viewBox="0 0 52 52" className="size-16" aria-hidden>
            <circle
              cx="26"
              cy="26"
              r="24"
              fill="none"
              stroke="#10b981"
              strokeWidth="3"
              style={{
                strokeDasharray: 166,
                strokeDashoffset: 166,
                animation: "spark-check-circle 0.6s ease-out 0.15s forwards",
              }}
            />
            <path
              d="M16 27 l7 7 l14 -16"
              fill="none"
              stroke="#10b981"
              strokeWidth="4"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{
                strokeDasharray: 48,
                strokeDashoffset: 48,
                animation: "spark-check-mark 0.35s ease-out 0.7s forwards",
              }}
            />
          </svg>
        </div>
      </div>

      <p
        className="spark-fade-up text-sm font-semibold tracking-widest text-emerald-50 uppercase"
        style={{ animationDelay: "0.5s" }}
      >
        Check-in confirmado
      </p>
      {guestName && (
        <h1
          className="spark-fade-up mt-2 text-4xl font-black"
          style={{ animationDelay: "0.62s" }}
        >
          {guestName}
        </h1>
      )}
      <p
        className="spark-fade-up mt-3 text-lg text-emerald-50"
        style={{ animationDelay: "0.74s" }}
      >
        Seja bem-vindo(a)! Obrigado por vir 🎉
      </p>
      {checkedInAt && (
        <p
          className="spark-fade-up mt-1 text-sm text-emerald-100/80"
          style={{ animationDelay: "0.82s" }}
        >
          Entrada às {new Date(checkedInAt).toLocaleTimeString("pt-BR")}
        </p>
      )}
      {capacityWarning && (
        <p
          className="spark-fade-up mt-4 rounded-md bg-black/25 px-4 py-2 text-sm font-semibold"
          style={{ animationDelay: "0.9s" }}
        >
          ⚠ Capacidade do evento atingida
        </p>
      )}

      <Button
        size="lg"
        variant="secondary"
        className="spark-fade-up mt-10 w-full max-w-xs text-lg"
        style={{ animationDelay: "1s" }}
        onClick={onNext}
      >
        Escanear próximo
      </Button>
    </div>
  );
}
