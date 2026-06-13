"use client";

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
    </div>
  );
}
