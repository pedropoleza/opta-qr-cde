"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import type { EventData, GuestRow } from "@/components/events/event-detail";

export function QrDeliveryTab({
  event,
  guests,
  appBaseUrl,
  onChange,
}: {
  event: EventData;
  guests: GuestRow[];
  appBaseUrl: string;
  onChange: () => void;
}) {
  const [generating, setGenerating] = useState(false);
  const pending = guests.filter(
    (g) => g.status !== "canceled" && !g.ticketToken
  ).length;
  const withTicket = guests.filter(
    (g) => g.ticketToken && g.status !== "canceled"
  );

  async function generate() {
    setGenerating(true);
    const res = await fetch(`/api/events/${event.id}/tickets/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    setGenerating(false);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(data.error ?? "Erro ao gerar QR Codes");
      return;
    }
    toast.success(`${data.generated} QR Code(s) gerado(s)`);
    onChange();
  }

  function copyLink(token: string) {
    navigator.clipboard.writeText(`${appBaseUrl}/q/${token}`);
    toast.success("Link copiado");
  }

  return (
    <div className="space-y-4 pt-4">
      <div className="flex items-center gap-4">
        <Button onClick={generate} disabled={generating || pending === 0}>
          {generating
            ? "Gerando..."
            : pending > 0
              ? `Gerar QR Codes (${pending} pendente${pending > 1 ? "s" : ""})`
              : "Todos os QR Codes gerados"}
        </Button>
        <p className="text-sm text-neutral-500">
          O envio por e-mail (via GHL/provedor) chega na Etapa 3 — por enquanto
          use o link público de cada convidado.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {withTicket.map((guest) => (
          <Card key={guest.id}>
            <CardContent className="flex flex-col items-center gap-2 p-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/qr/${guest.ticketToken}`}
                alt={`QR de ${guest.name}`}
                className="h-36 w-36"
              />
              <p className="w-full truncate text-center text-sm font-medium">
                {guest.name}
              </p>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" asChild>
                  <a
                    href={`/api/qr/${guest.ticketToken}`}
                    download={`qr-${guest.name.replace(/\s+/g, "-").toLowerCase()}.png`}
                  >
                    PNG
                  </a>
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => copyLink(guest.ticketToken!)}
                >
                  Copiar link
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      {withTicket.length === 0 && (
        <p className="py-8 text-center text-sm text-neutral-500">
          Nenhum QR gerado ainda. Adicione convidados e clique em Gerar QR Codes.
        </p>
      )}
    </div>
  );
}
