"use client";

import { useState } from "react";
import { Check, X } from "lucide-react";

// #10 Botões de confirmação de presença na página do ingresso.
export function RsvpButtons({
  token,
  initial,
}: {
  token: string;
  initial: string | null;
}) {
  const [rsvp, setRsvp] = useState<string | null>(initial);
  const [busy, setBusy] = useState(false);

  async function send(value: "yes" | "no") {
    setBusy(true);
    try {
      const res = await fetch(`/api/q/${token}/rsvp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rsvp: value }),
      });
      if (res.ok) setRsvp(value);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4">
      <p className="mb-2 text-sm font-medium text-neutral-700">
        Você vai comparecer?
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => send("yes")}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors disabled:opacity-60 ${
            rsvp === "yes"
              ? "border-green-600 bg-green-600 text-white"
              : "border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50"
          }`}
        >
          <Check className="size-4" /> Confirmar
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => send("no")}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors disabled:opacity-60 ${
            rsvp === "no"
              ? "border-neutral-700 bg-neutral-700 text-white"
              : "border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50"
          }`}
        >
          <X className="size-4" /> Não vou
        </button>
      </div>
      {rsvp === "yes" && (
        <p className="mt-2 text-xs text-green-700">Presença confirmada. 🎉</p>
      )}
      {rsvp === "no" && (
        <p className="mt-2 text-xs text-neutral-500">
          Tudo bem, obrigado por avisar.
        </p>
      )}
    </div>
  );
}
