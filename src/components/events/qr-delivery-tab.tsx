"use client";

import { useState } from "react";
import { Copy, Eye, Loader2, Send } from "lucide-react";
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
import {
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import {
  GUEST_STATUS_LABEL,
  GUEST_STATUS_VARIANT,
} from "@/components/events/status";
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
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [detail, setDetail] = useState<GuestRow | null>(null);

  const active = guests.filter((g) => g.status !== "canceled");
  const pending = active.filter((g) => !g.ticketToken).length;
  const withTicket = active.filter((g) => g.ticketToken);
  const notSent = withTicket.filter((g) => g.status === "qr_generated").length;
  const sentCount = active.filter((g) => g.status === "email_sent").length;

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
    toast.success(`${data.sent} convidado(s) disparados pela automação Spark`);
    if (data.withoutGhlContact > 0) {
      toast.warning(
        `${data.withoutGhlContact} ainda sem contato Spark vinculado — entram na fila e saem assim que o contato for conectado`
      );
    }
    onChange();
  }

  // Envio individual: dispara o convite só para um convidado (ou reenvia).
  async function sendOne(guest: GuestRow) {
    setSendingId(guest.id);
    const res = await fetch(`/api/events/${event.id}/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ guestIds: [guest.id] }),
    });
    setSendingId(null);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(data.error ?? "Erro ao enviar");
      return;
    }
    toast.success(`Convite de ${guest.name} disparado`);
    if (data.withoutGhlContact > 0) {
      toast.warning(
        `${guest.name} ainda sem contato Spark vinculado — entra na fila e sai quando o contato for conectado`,
      );
    }
    // Mantém o drawer coerente sem esperar o refresh.
    setDetail((d) => (d && d.id === guest.id ? { ...d, status: "email_sent" } : d));
    onChange();
  }

  function copyLink(token: string) {
    navigator.clipboard.writeText(`${appBaseUrl}/q/${token}`);
    toast.success("Link copiado");
  }

  // Painel demonstrativo: mostra ao organizador como o disparo funciona e em
  // qual passo o evento está, deixando a próxima ação óbvia.
  const steps = [
    {
      n: 1,
      title: "Convidados na lista",
      done: active.length > 0,
      detail: `${active.length} convidado(s) adicionado(s).`,
    },
    {
      n: 2,
      title: "QR Codes gerados",
      done: pending === 0 && withTicket.length > 0,
      detail:
        pending > 0
          ? `${pending} ainda sem QR. Clique em "Gerar QR Codes".`
          : `${withTicket.length} QR Code(s) único(s) e assinado(s).`,
    },
    {
      n: 3,
      title: "Disparo do convite",
      done: notSent === 0 && sentCount > 0,
      detail:
        notSent > 0
          ? `${notSent} pronto(s) para enviar. Clique em "Enviar convite".`
          : sentCount > 0
            ? `${sentCount} convite(s) disparado(s).`
            : "Aguardando geração dos QR Codes.",
    },
  ];

  return (
    <div className="space-y-5 pt-4">
      {/* Passo a passo do disparo */}
      <Card>
        <CardContent className="p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h3 className="font-semibold">Disparo do convite</h3>
              <p className="text-sm text-muted-foreground">
                Em 3 passos o convidado recebe o ingresso por e-mail, com o QR
                Code de entrada.
              </p>
            </div>
            <HowItWorksDialog />
          </div>

          <ol className="grid gap-3 sm:grid-cols-3">
            {steps.map((s) => (
              <li
                key={s.n}
                className={`rounded-lg border p-3 ${
                  s.done
                    ? "border-green-500/30 bg-green-500/10"
                    : "bg-card"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                      s.done
                        ? "bg-green-600 text-white"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {s.done ? "✓" : s.n}
                  </span>
                  <span className="text-sm font-medium">{s.title}</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{s.detail}</p>
              </li>
            ))}
          </ol>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button onClick={generate} disabled={generating || pending === 0}>
              {generating
                ? "Gerando..."
                : pending > 0
                  ? `Gerar QR Codes (${pending})`
                  : "QR Codes gerados ✓"}
            </Button>
            <Button
              variant={notSent > 0 ? "default" : "secondary"}
              onClick={sendAll}
              disabled={sending || notSent === 0}
            >
              {sending
                ? "Disparando..."
                : notSent > 0
                  ? `Enviar convite (${notSent})`
                  : "Convites enviados ✓"}
            </Button>
            <PreviewDialog event={event} appBaseUrl={appBaseUrl} />
          </div>
        </CardContent>
      </Card>

      {/* Visualização dos QR Codes gerados */}
      {withTicket.length > 0 && (
        <div>
          <h3 className="mb-3 text-sm font-medium text-muted-foreground">
            QR Codes do evento ({withTicket.length})
          </h3>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {withTicket.map((guest) => (
              <Card key={guest.id}>
                <CardContent className="flex flex-col items-center gap-2 p-4">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/api/qr/${guest.ticketToken}`}
                    alt={`QR de ${guest.name}`}
                    className="h-32 w-32 rounded-md border bg-white p-1.5"
                  />
                  <p className="w-full truncate text-center text-sm font-medium">
                    {guest.name}
                  </p>
                  <QrStatusBadge status={guest.status} />
                  <div className="flex w-full gap-2 pt-1">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1"
                      onClick={() => setDetail(guest)}
                    >
                      <Eye /> Ver
                    </Button>
                    {guest.status !== "checked_in" && (
                      <Button
                        size="sm"
                        variant={guest.status === "email_sent" ? "secondary" : "default"}
                        className="flex-1"
                        disabled={sendingId === guest.id}
                        onClick={() => sendOne(guest)}
                      >
                        {sendingId === guest.id ? (
                          <Loader2 className="animate-spin" />
                        ) : (
                          <Send />
                        )}
                        {guest.status === "email_sent" ? "Reenviar" : "Enviar"}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
      {withTicket.length === 0 && (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Nenhum QR gerado ainda. Adicione convidados na aba Convidados e clique
          em Gerar QR Codes.
        </p>
      )}

      {/* Detalhe do QR por convidado: visualizar, copiar link, baixar e enviar */}
      <Drawer
        open={detail !== null}
        onOpenChange={(open) => {
          if (!open) setDetail(null);
        }}
      >
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Ingresso de {detail?.name}</DrawerTitle>
            <DrawerDescription>
              {detail?.email ?? "Sem e-mail cadastrado"}
            </DrawerDescription>
          </DrawerHeader>
          <DrawerBody className="space-y-4">
            {detail?.ticketToken && (
              <>
                <div className="flex justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/api/qr/${detail.ticketToken}`}
                    alt={`QR de ${detail.name}`}
                    className="h-52 w-52 rounded-lg border bg-white p-2"
                  />
                </div>
                <div className="flex justify-center">
                  <QrStatusBadge status={detail.status} />
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">
                    Link do ingresso
                  </p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 truncate rounded-md bg-muted px-2 py-1.5 text-xs">
                      {appBaseUrl}/q/{detail.ticketToken}
                    </code>
                    <Button
                      size="icon-sm"
                      variant="outline"
                      aria-label="Copiar link"
                      onClick={() => copyLink(detail.ticketToken!)}
                    >
                      <Copy />
                    </Button>
                  </div>
                </div>
              </>
            )}
          </DrawerBody>
          <DrawerFooter>
            {detail?.ticketToken && (
              <Button variant="outline" asChild>
                <a
                  href={`/api/qr/${detail.ticketToken}`}
                  download={`qr-${detail.name.replace(/\s+/g, "-").toLowerCase()}.png`}
                >
                  Baixar PNG
                </a>
              </Button>
            )}
            {detail && detail.status !== "checked_in" && (
              <Button
                disabled={sendingId === detail.id}
                onClick={() => sendOne(detail)}
              >
                {sendingId === detail.id ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <Send />
                )}
                {detail.status === "email_sent"
                  ? "Reenviar convite"
                  : "Enviar convite"}
              </Button>
            )}
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </div>
  );
}

// Badge de status do QR por convidado, com destaque para "enviado".
function QrStatusBadge({ status }: { status: string }) {
  if (status === "email_sent") {
    return (
      <Badge className="border-transparent bg-success text-xs text-success-foreground">
        Convite enviado
      </Badge>
    );
  }
  if (status === "checked_in") {
    return <Badge className="text-xs">Check-in feito</Badge>;
  }
  return (
    <Badge variant={GUEST_STATUS_VARIANT[status] ?? "outline"} className="text-xs">
      {GUEST_STATUS_LABEL[status] ?? "Aguardando envio"}
    </Badge>
  );
}

// Explica, em linguagem do usuário, como o disparo é executado por baixo.
function HowItWorksDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          Como funciona?
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Como o disparo do convite funciona</DialogTitle>
          <DialogDescription>
            O Spark cuida de todo o caminho até o convidado.
          </DialogDescription>
        </DialogHeader>
        <ol className="space-y-3 text-sm">
          <li className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
              1
            </span>
            <p>
              Você <strong>gera os QR Codes</strong>: cada convidado recebe um
              código único e assinado, que só pode ser usado uma vez na entrada.
            </p>
          </li>
          <li className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
              2
            </span>
            <p>
              Você clica em <strong>Enviar convite</strong>. O Spark grava o
              ingresso no contato e aciona a <strong>automação Spark</strong>,
              que envia o e-mail com a imagem do QR e o botão do ingresso.
            </p>
          </li>
          <li className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
              3
            </span>
            <p>
              O convidado recebe o e-mail e, na entrada, a equipe escaneia o QR
              pelo <strong>modo Checker</strong> — verde libera, amarelo já
              entrou, vermelho inválido.
            </p>
          </li>
        </ol>
        <p className="rounded-md bg-muted p-3 text-xs text-muted-foreground">
          Cada etapa do convidado também marca o contato no Spark
          (convidado → convite enviado → presente / não compareceu), permitindo
          disparar follow-ups automáticos por evento.
        </p>
      </DialogContent>
    </Dialog>
  );
}

// Pré-visualização do e-mail que a automação Spark envia (imagem + botão, D2).
function PreviewDialog({
  event,
  appBaseUrl,
}: {
  event: EventData;
  appBaseUrl: string;
}) {
  const sampleLink = `${appBaseUrl}/q/exemplo`;
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost">Ver e-mail do convidado</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Prévia do e-mail</DialogTitle>
          <DialogDescription>
            É isto que o convidado recebe quando você dispara o convite.
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-lg border bg-white p-5 text-center text-sm">
          <p className="text-lg font-bold">{event.name}</p>
          <p className="text-neutral-500">
            {event.date}
            {event.locationName ? ` · ${event.locationName}` : ""}
          </p>
          <p className="mt-3">
            Olá <span className="rounded bg-neutral-100 px-1">[nome]</span>, aqui
            está o seu ingresso:
          </p>
          <div className="my-4 flex justify-center">
            <div className="flex h-36 w-36 items-center justify-center rounded border-2 border-dashed text-xs text-neutral-400">
              imagem do QR
            </div>
          </div>
          <span className="inline-block rounded-md bg-neutral-900 px-4 py-2 text-white">
            Ver meu ingresso
          </span>
          <p className="mt-2 break-all text-xs text-neutral-400">{sampleLink}</p>
        </div>
        <p className="text-xs text-muted-foreground">
          O modelo e o disparo são executados pela automação Spark do evento
          (gatilho: convite enviado · <code>{event.slug}</code>).
        </p>
      </DialogContent>
    </Dialog>
  );
}
