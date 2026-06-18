"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
  const [sending, setSending] = useState(false);
  const pending = guests.filter(
    (g) => g.status !== "canceled" && !g.ticketToken
  ).length;
  const withTicket = guests.filter(
    (g) => g.ticketToken && g.status !== "canceled"
  );
  const notSent = withTicket.filter((g) => g.status === "qr_generated").length;

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

  async function sendAll() {
    setSending(true);
    const res = await fetch(`/api/events/${event.id}/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    setSending(false);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(data.error ?? "Erro ao enviar");
      return;
    }
    toast.success(`${data.sent} convidado(s) marcados para envio via GHL`);
    if (data.withoutGhlContact > 0) {
      toast.warning(
        `${data.withoutGhlContact} sem contato no GHL — serão enviados após vincular o contato (Etapa 4)`
      );
    }
    onChange();
  }

  function copyLink(token: string) {
    navigator.clipboard.writeText(`${appBaseUrl}/q/${token}`);
    toast.success("Link copiado");
  }

  return (
    <div className="space-y-4 pt-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={generate} disabled={generating || pending === 0}>
          {generating
            ? "Gerando..."
            : pending > 0
              ? `Gerar QR Codes (${pending} pendente${pending > 1 ? "s" : ""})`
              : "Todos os QR Codes gerados"}
        </Button>
        <Button
          variant="secondary"
          onClick={sendAll}
          disabled={sending || notSent === 0}
        >
          {sending
            ? "Enviando..."
            : notSent > 0
              ? `Enviar QR por e-mail (${notSent})`
              : "Tudo enviado"}
        </Button>
        <EmailTemplatePreview event={event} appBaseUrl={appBaseUrl} />
      </div>

      <p className="text-sm text-neutral-500">
        O e-mail é disparado pela <strong>automação do HighLevel</strong> (D1):
        o app grava o link e a imagem do QR no contato e aplica a tag-gatilho
        <code className="mx-1">qrcode-enviado-{event.slug}</code>, que faz o
        workflow do GHL enviar o e-mail. Efetivado quando o GHL estiver
        conectado (Etapa 4).
      </p>

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
              {guest.status === "email_sent" && (
                <Badge variant="outline" className="text-xs">
                  Enviado
                </Badge>
              )}
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

// Preview do e-mail que o workflow do GHL deve enviar (imagem + botão, D2).
// Serve de referência para o Time montar o template no HighLevel usando as
// variáveis do contato ({{contact.event_qr_image}} etc.).
function EmailTemplatePreview({
  event,
  appBaseUrl,
}: {
  event: EventData;
  appBaseUrl: string;
}) {
  const sampleLink = `${appBaseUrl}/q/exemplo-token`;
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost">Ver template do e-mail</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Template do e-mail (GHL)</DialogTitle>
          <DialogDescription>
            Modelo para o workflow do HighLevel. As variáveis entre chaves são
            preenchidas pelos custom fields do contato.
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-lg border bg-white p-5 text-center text-sm">
          <p className="text-lg font-bold">{event.name}</p>
          <p className="text-neutral-500">
            {event.date}
            {event.locationName ? ` · ${event.locationName}` : ""}
          </p>
          <p className="mt-3">
            Olá <span className="rounded bg-neutral-100 px-1">{"{{contact.name}}"}</span>,
            aqui está o seu ingresso:
          </p>
          <div className="my-4 flex justify-center">
            <div className="flex h-36 w-36 items-center justify-center rounded border-2 border-dashed text-xs text-neutral-400">
              {"{{contact.event_qr_image}}"}
            </div>
          </div>
          <span className="inline-block rounded-md bg-neutral-900 px-4 py-2 text-white">
            Ver meu ingresso
          </span>
          <p className="mt-2 break-all text-xs text-neutral-400">
            {"{{contact.event_qr_link}}"} → {sampleLink}
          </p>
        </div>
        <p className="text-xs text-neutral-500">
          Custom fields usados: <code>event_qr_image</code> (imagem do QR),
          <code className="mx-1">event_qr_link</code> (página do ingresso),
          <code>event_name</code>, <code>event_date</code>,
          <code className="ml-1">event_location</code>. Gatilho do workflow: tag
          <code className="mx-1">qrcode-enviado-{event.slug}</code>.
        </p>
      </DialogContent>
    </Dialog>
  );
}
