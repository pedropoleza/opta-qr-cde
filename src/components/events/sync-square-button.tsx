"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

// Sincroniza o catálogo do Square → eventos (nome + preço vêm do Square).
export function SyncSquareButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function sync() {
    setBusy(true);
    try {
      const res = await fetch("/api/square/catalog/sync", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(
          data?.error
            ? `Square: ${data.error}`
            : res.status === 503
              ? "Square não configurado."
              : "Não foi possível sincronizar.",
        );
        return;
      }
      const parts = [
        data.created ? `${data.created} novo(s)` : null,
        data.updated ? `${data.updated} atualizado(s)` : null,
        data.skipped ? `${data.skipped} sem preço` : null,
      ].filter(Boolean);
      toast.success(
        parts.length ? `Sincronizado: ${parts.join(", ")}` : "Catálogo já estava em dia",
      );
      router.refresh();
    } catch {
      toast.error("Falha de conexão ao sincronizar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button variant="outline" onClick={sync} disabled={busy}>
      {busy ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <RefreshCw className="size-4" />
      )}
      Sincronizar do Square
    </Button>
  );
}
