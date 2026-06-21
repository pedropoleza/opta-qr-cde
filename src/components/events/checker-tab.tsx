"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import type { EventData } from "@/components/events/event-detail";

// D4: a pessoa da entrada recebe este link + PIN — sem login e sem acesso
// ao painel do organizador.
export function CheckerTab({
  event,
  appBaseUrl,
}: {
  event: EventData;
  appBaseUrl: string;
}) {
  const checkerUrl = `${appBaseUrl}/checker/${event.checkerToken}`;
  const [kioskToken, setKioskToken] = useState<string | null>(null);
  const [kioskBusy, setKioskBusy] = useState(false);

  useEffect(() => {
    fetch(`/api/events/${event.id}/kiosk`)
      .then((r) => (r.ok ? r.json() : { kioskToken: null }))
      .then((d) => setKioskToken(d.kioskToken))
      .catch(() => {});
  }, [event.id]);

  async function enableKiosk() {
    setKioskBusy(true);
    const res = await fetch(`/api/events/${event.id}/kiosk`, { method: "POST" });
    const d = await res.json().catch(() => ({}));
    setKioskBusy(false);
    if (!res.ok) {
      toast.error(d.error ?? "Erro ao gerar o totem");
      return;
    }
    setKioskToken(d.kioskToken);
    toast.success("Totem habilitado");
  }
  async function disableKiosk() {
    setKioskBusy(true);
    await fetch(`/api/events/${event.id}/kiosk`, { method: "DELETE" });
    setKioskBusy(false);
    setKioskToken(null);
    toast.success("Totem desativado");
  }

  const kioskUrl = kioskToken ? `${appBaseUrl}/kiosk/${kioskToken}` : "";

  return (
    <div className="max-w-xl space-y-4 pt-4">
      <Card>
        <CardHeader>
          <CardTitle>Modo Checker</CardTitle>
          <CardDescription>
            Compartilhe o link e o PIN com a pessoa da entrada. Ela abre o link
            no celular, digita o PIN e escaneia os QR Codes dos convidados.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Link do Checker</Label>
            <div className="flex gap-2">
              <Input readOnly value={checkerUrl} />
              <Button
                variant="outline"
                onClick={() => {
                  navigator.clipboard.writeText(checkerUrl);
                  toast.success("Link copiado");
                }}
              >
                Copiar
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <Label>PIN</Label>
            <div className="flex gap-2">
              <Input readOnly value={event.checkerPin} className="w-32 font-mono text-lg" />
              <Button
                variant="outline"
                onClick={() => {
                  navigator.clipboard.writeText(event.checkerPin);
                  toast.success("PIN copiado");
                }}
              >
                Copiar
              </Button>
            </div>
          </div>
          {event.status !== "active" && (
            <p className="text-sm text-amber-600">
              O evento precisa estar com status <strong>Ativo</strong> para os
              check-ins serem aceitos (mude na aba Configurações).
            </p>
          )}
          <Button asChild className="w-full">
            <a href={checkerUrl} target="_blank" rel="noreferrer">
              Abrir Checker neste dispositivo
            </a>
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Totem de auto-checkin</CardTitle>
          <CardDescription>
            Tablet na entrada onde o próprio convidado busca o nome e faz o
            check-in sozinho — sem operador e sem PIN. Descongestiona a fila.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {kioskToken ? (
            <>
              <div className="space-y-2">
                <Label>Link do totem</Label>
                <div className="flex gap-2">
                  <Input readOnly value={kioskUrl} />
                  <Button
                    variant="outline"
                    onClick={() => {
                      navigator.clipboard.writeText(kioskUrl);
                      toast.success("Link copiado");
                    }}
                  >
                    Copiar
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Abra esse link no tablet e deixe em tela cheia. Qualquer pessoa
                  com o link pode buscar nomes — mantenha-o no dispositivo da
                  entrada.
                </p>
              </div>
              <div className="flex gap-2">
                <Button asChild className="flex-1">
                  <a href={kioskUrl} target="_blank" rel="noreferrer">
                    Abrir totem
                  </a>
                </Button>
                <Button variant="outline" onClick={enableKiosk} disabled={kioskBusy}>
                  Gerar novo link
                </Button>
                <Button variant="ghost" onClick={disableKiosk} disabled={kioskBusy}>
                  Desativar
                </Button>
              </div>
            </>
          ) : (
            <Button onClick={enableKiosk} disabled={kioskBusy} className="w-full">
              {kioskBusy ? "Habilitando…" : "Habilitar totem"}
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
