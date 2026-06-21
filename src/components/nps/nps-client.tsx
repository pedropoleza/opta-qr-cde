"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function NpsClient({
  token,
  eventName,
  guestName,
  alreadyScored,
  checkedIn,
  brandName,
  primaryColor,
}: {
  token: string;
  eventName: string;
  guestName: string;
  alreadyScored: boolean;
  checkedIn: boolean;
  brandName: string | null;
  primaryColor: string | null;
}) {
  const brand = primaryColor || "#4f46e5";
  const [score, setScore] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [done, setDone] = useState(alreadyScored);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (score == null) return;
    setBusy(true);
    const res = await fetch(`/api/nps/${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ score, comment }),
    });
    setBusy(false);
    if (res.ok) setDone(true);
  }

  if (done) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-50 p-6">
        <div className="w-full max-w-sm rounded-2xl bg-white p-8 text-center shadow-sm">
          <div
            className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full text-2xl text-white"
            style={{ backgroundColor: brand }}
          >
            ✓
          </div>
          <h1 className="text-xl font-bold">Obrigado pelo retorno!</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Sua opinião sobre o {eventName} foi registrada.
          </p>
          {checkedIn && (
            <Button asChild className="mt-6 w-full" style={{ backgroundColor: brand }}>
              <a href={`/api/ticket/${token}/certificate`} target="_blank" rel="noreferrer">
                Baixar certificado de participação
              </a>
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 p-6">
      <div className="w-full max-w-md rounded-2xl bg-white p-7 shadow-sm">
        <p className="text-xs uppercase tracking-widest" style={{ color: brand }}>
          {brandName || "Pesquisa"}
        </p>
        <h1 className="mt-1 text-xl font-bold">Como foi o {eventName}?</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Olá {guestName}! De 0 a 10, o quanto você recomendaria este evento?
        </p>

        <div className="mt-5 grid grid-cols-6 gap-2 sm:grid-cols-11">
          {Array.from({ length: 11 }, (_, n) => (
            <button
              key={n}
              onClick={() => setScore(n)}
              className="aspect-square rounded-lg border text-sm font-semibold transition"
              style={
                score === n
                  ? { backgroundColor: brand, color: "#fff", borderColor: brand }
                  : undefined
              }
            >
              {n}
            </button>
          ))}
        </div>
        <div className="mt-1 flex justify-between text-xs text-neutral-400">
          <span>Não recomendaria</span>
          <span>Recomendaria muito</span>
        </div>

        <Textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Quer deixar um comentário? (opcional)"
          rows={3}
          className="mt-4"
        />

        <Button
          onClick={submit}
          disabled={score == null || busy}
          className="mt-4 w-full"
          style={{ backgroundColor: brand }}
        >
          {busy ? "Enviando…" : "Enviar avaliação"}
        </Button>
      </div>
    </div>
  );
}
