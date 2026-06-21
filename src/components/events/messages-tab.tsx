"use client";

import { useEffect, useState } from "react";
import { Loader2, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const VARIABLES = [
  "nome",
  "evento",
  "data",
  "hora",
  "local",
  "endereco",
  "valor",
  "link_qr",
];

const KIND_META: Record<string, { title: string; hint: string; subject: boolean }> = {
  registration: {
    title: "Confirmação de inscrição",
    hint: "Enviada quando a pessoa se inscreve (antes do pagamento).",
    subject: true,
  },
  qr_delivery: {
    title: "Entrega do QR (pago)",
    hint: "Enviada automaticamente quando o pagamento é confirmado.",
    subject: true,
  },
  reminder: {
    title: "Lembrete",
    hint: "Usada nos lembretes agendados (D-3, D-1, etc.).",
    subject: false,
  },
};

type Tpl = { kind: string; subject: string | null; body: string; active: boolean };

function TemplateCard({
  eventId,
  kind,
  initial,
}: {
  eventId: string;
  kind: string;
  initial: Tpl | undefined;
}) {
  const meta = KIND_META[kind];
  const [subject, setSubject] = useState(initial?.subject ?? "");
  const [body, setBody] = useState(initial?.body ?? "");
  const [saving, setSaving] = useState(false);

  function insertVar(v: string) {
    setBody((b) => `${b}${b && !b.endsWith(" ") ? " " : ""}{{${v}}}`);
  }

  async function save() {
    setSaving(true);
    const res = await fetch(`/api/events/${eventId}/templates`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, subject, body, active: true }),
    });
    setSaving(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      toast.error(d.error ?? "Erro ao salvar");
      return;
    }
    toast.success(`${meta.title} salva`);
  }

  return (
    <Card>
      <CardContent className="space-y-3 p-5">
        <div>
          <p className="font-medium">{meta.title}</p>
          <p className="text-xs text-muted-foreground">{meta.hint}</p>
        </div>
        {meta.subject && (
          <div className="space-y-1.5">
            <Label>Assunto (e-mail)</Label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder={`Seu ingresso — {{evento}}`}
            />
          </div>
        )}
        <div className="space-y-1.5">
          <Label>Mensagem</Label>
          <Textarea
            rows={4}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Olá {{nome}}! Seu acesso ao {{evento}} é {{data}}. Ingresso: {{link_qr}}"
          />
          <div className="flex flex-wrap gap-1.5">
            {VARIABLES.map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => insertVar(v)}
                className="rounded-md border bg-muted/40 px-2 py-0.5 text-xs font-mono hover:bg-muted"
              >
                {`{{${v}}}`}
              </button>
            ))}
          </div>
        </div>
        <Button onClick={save} disabled={saving || !body.trim()} size="sm">
          {saving && <Loader2 className="size-4 animate-spin" />} Salvar
        </Button>
      </CardContent>
    </Card>
  );
}

export function MessagesTab({ eventId }: { eventId: string }) {
  const [templates, setTemplates] = useState<Tpl[] | null>(null);
  const [reg, setReg] = useState<{ on: boolean; channel: string } | null>(null);

  async function load() {
    const [t, i] = await Promise.all([
      fetch(`/api/events/${eventId}/templates`).then((r) => (r.ok ? r.json() : { templates: [] })),
      fetch(`/api/events/${eventId}/integration`).then((r) => (r.ok ? r.json() : null)),
    ]);
    setTemplates(t.templates ?? []);
    if (i) setReg({ on: i.sendMsgOnRegistration, channel: i.registrationChannel });
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  async function patchReg(body: Record<string, unknown>) {
    await fetch(`/api/events/${eventId}/integration`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    load();
  }

  if (!templates) return <p className="text-sm text-muted-foreground">Carregando…</p>;
  const byKind = (k: string) => templates.find((t) => t.kind === k);

  return (
    <div className="max-w-2xl space-y-5 pt-2">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <MessageSquare className="size-4" />
        Mensagens com variáveis. O app substitui {`{{nome}}`}, {`{{evento}}`},{" "}
        {`{{link_qr}}`} etc. no envio.
      </div>

      {reg && (
        <Card>
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-5">
            <div>
              <p className="text-sm font-medium">Enviar confirmação ao inscrever</p>
              <p className="text-xs text-muted-foreground">
                Dispara a mensagem de inscrição assim que o formulário entra.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Select
                value={reg.channel}
                onValueChange={(v) => patchReg({ registrationChannel: v })}
              >
                <SelectTrigger className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                  <SelectItem value="email">E-mail</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant={reg.on ? "default" : "outline"}
                size="sm"
                onClick={() => patchReg({ sendMsgOnRegistration: !reg.on })}
              >
                {reg.on ? "Ligado" : "Desligado"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <TemplateCard eventId={eventId} kind="registration" initial={byKind("registration")} />
      <TemplateCard eventId={eventId} kind="qr_delivery" initial={byKind("qr_delivery")} />
      <TemplateCard eventId={eventId} kind="reminder" initial={byKind("reminder")} />
    </div>
  );
}
