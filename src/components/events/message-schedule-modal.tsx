"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CalendarClock,
  CreditCard,
  Loader2,
  Plus,
  Trash2,
  UserPlus,
  Clock,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const VARIABLES = ["nome", "evento", "data", "hora", "local", "link_qr", "valor"];
const CHANNELS = [
  { v: "whatsapp", label: "WhatsApp" },
  { v: "email", label: "E-mail" },
  { v: "ghl", label: "Spark (tag)" },
];
const AUDIENCES = [
  { v: "paid", label: "Pagos" },
  { v: "confirmed", label: "Confirmados" },
  { v: "all", label: "Todos" },
];

// ---- helpers de timing (offsetHours: negativo=antes, positivo=depois) ----
function offsetToParts(h: number): { dir: "antes" | "depois"; amount: number; unit: "horas" | "dias" } {
  const dir = h <= 0 ? "antes" : "depois";
  const abs = Math.abs(h);
  if (abs !== 0 && abs % 24 === 0) return { dir, amount: abs / 24, unit: "dias" };
  return { dir, amount: abs || 1, unit: "horas" };
}
function partsToOffset(dir: "antes" | "depois", amount: number, unit: "horas" | "dias"): number {
  const hours = (amount || 1) * (unit === "dias" ? 24 : 1);
  return dir === "antes" ? -hours : hours;
}
function timingLabel(h: number): string {
  const { dir, amount, unit } = offsetToParts(h);
  return `${amount} ${unit} ${dir}`;
}

type Tpl = { kind: string; subject: string | null; body: string; active: boolean };
type Rule = {
  id: string;
  offsetHours: number;
  channel: string;
  audience: string;
  label: string | null;
  subject: string | null;
  body: string | null;
  active: boolean;
  lastRunAt: string | null;
};
type Integ = {
  autoSendQrOnPaid: boolean;
  sendChannel: string;
  sendMsgOnRegistration: boolean;
  registrationChannel: string;
} | null;

function VarChips({ onPick }: { onPick: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {VARIABLES.map((v) => (
        <button
          key={v}
          type="button"
          onClick={() => onPick(v)}
          className="rounded-md border bg-muted/40 px-2 py-0.5 text-xs font-mono hover:bg-muted"
        >{`{{${v}}}`}</button>
      ))}
    </div>
  );
}

// Nó da timeline: bolinha + linha + conteúdo.
function Node({
  icon,
  tone,
  title,
  meta,
  children,
  last,
}: {
  icon: React.ReactNode;
  tone: string;
  title: string;
  meta?: React.ReactNode;
  children: React.ReactNode;
  last?: boolean;
}) {
  return (
    <div className="relative flex gap-4">
      <div className="flex flex-col items-center">
        <span className={`flex size-9 shrink-0 items-center justify-center rounded-full ${tone}`}>
          {icon}
        </span>
        {!last && <span className="mt-1 w-px flex-1 bg-border" />}
      </div>
      <div className="flex-1 pb-6">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <h3 className="font-semibold">{title}</h3>
          {meta}
        </div>
        {children}
      </div>
    </div>
  );
}

// Editor de assunto+corpo com variáveis.
function MsgFields({
  subject,
  onSubject,
  body,
  onBody,
  withSubject,
  placeholder,
}: {
  subject?: string;
  onSubject?: (v: string) => void;
  body: string;
  onBody: (v: string) => void;
  withSubject?: boolean;
  placeholder?: string;
}) {
  return (
    <div className="space-y-2">
      {withSubject && (
        <Input
          value={subject ?? ""}
          onChange={(e) => onSubject?.(e.target.value)}
          placeholder="Assunto (e-mail) — ex.: Seu ingresso {{evento}}"
          className="text-sm"
        />
      )}
      <Textarea
        rows={3}
        value={body}
        onChange={(e) => onBody(e.target.value)}
        placeholder={placeholder ?? "Escreva a mensagem… use as variáveis abaixo."}
        className="text-sm"
      />
      <VarChips onPick={(v) => onBody(`${body}${body && !body.endsWith(" ") ? " " : ""}{{${v}}}`)} />
    </div>
  );
}

export function MessageScheduleModal({
  eventId,
  eventName,
}: {
  eventId: string;
  eventName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [templates, setTemplates] = useState<Tpl[]>([]);
  const [integ, setInteg] = useState<Integ>(null);
  const [rules, setRules] = useState<Rule[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    const [t, i, r] = await Promise.all([
      fetch(`/api/events/${eventId}/templates`).then((x) => (x.ok ? x.json() : { templates: [] })),
      fetch(`/api/events/${eventId}/integration`).then((x) => (x.ok ? x.json() : null)),
      fetch(`/api/events/${eventId}/reminders`).then((x) => (x.ok ? x.json() : { rules: [] })),
    ]);
    setTemplates(t.templates ?? []);
    setInteg(i);
    setRules(r.rules ?? []);
    setLoading(false);
  }, [eventId]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  const before = rules.filter((r) => r.offsetHours <= 0).sort((a, b) => a.offsetHours - b.offsetHours);
  const after = rules.filter((r) => r.offsetHours > 0).sort((a, b) => a.offsetHours - b.offsetHours);

  async function patchInteg(body: Record<string, unknown>) {
    setInteg((s) => (s ? { ...s, ...body } : s));
    await fetch(`/api/events/${eventId}/integration`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  async function addRule(dir: "antes" | "depois") {
    const offsetHours = dir === "antes" ? -24 : 24;
    const res = await fetch(`/api/events/${eventId}/reminders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ offsetHours, channel: "whatsapp", audience: "paid" }),
    });
    if (!res.ok) return toast.error("Erro ao adicionar");
    toast.success("Mensagem agendada");
    load();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <CalendarClock /> Agenda de mensagens
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[88vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Agenda de mensagens{eventName ? ` — ${eventName}` : ""}</DialogTitle>
          <DialogDescription>
            Toda a jornada de comunicação do convidado, do cadastro ao pós-evento.
            As variáveis ({`{{nome}}`}, {`{{link_qr}}`}…) são preenchidas no envio.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="mr-2 size-4 animate-spin" /> Carregando…
          </div>
        ) : (
          <div className="pt-2">
            {/* 1. No cadastro */}
            <Node
              icon={<UserPlus className="size-4" />}
              tone="bg-sky-500/15 text-sky-600"
              title="No cadastro"
              meta={
                <Badge variant={integ?.sendMsgOnRegistration ? "default" : "outline"}>
                  {integ?.sendMsgOnRegistration ? "Ativo" : "Desativado"}
                </Badge>
              }
            >
              <p className="mb-2 text-sm text-muted-foreground">
                Enviada assim que a pessoa se inscreve (antes do pagamento).
              </p>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  variant={integ?.sendMsgOnRegistration ? "default" : "outline"}
                  onClick={() => patchInteg({ sendMsgOnRegistration: !integ?.sendMsgOnRegistration })}
                >
                  {integ?.sendMsgOnRegistration ? "Ligado" : "Desligado"}
                </Button>
                <Select
                  value={integ?.registrationChannel ?? "whatsapp"}
                  onValueChange={(v) => patchInteg({ registrationChannel: v })}
                >
                  <SelectTrigger className="h-8 w-36 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="whatsapp">WhatsApp</SelectItem>
                    <SelectItem value="email">E-mail</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <TemplateBlock eventId={eventId} kind="registration" templates={templates} withSubject />
            </Node>

            {/* 2. No pagamento */}
            <Node
              icon={<CreditCard className="size-4" />}
              tone="bg-emerald-500/15 text-emerald-600"
              title="No pagamento (entrega do ingresso)"
              meta={
                <Badge variant={integ?.autoSendQrOnPaid ? "default" : "outline"}>
                  {integ?.autoSendQrOnPaid ? "Automático" : "Manual"}
                </Badge>
              }
            >
              <p className="mb-2 text-sm text-muted-foreground">
                Dispara o ingresso (PDF + QR) automaticamente quando o pagamento é confirmado.
              </p>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  variant={integ?.autoSendQrOnPaid ? "default" : "outline"}
                  onClick={() => patchInteg({ autoSendQrOnPaid: !integ?.autoSendQrOnPaid })}
                >
                  {integ?.autoSendQrOnPaid ? "Envio automático ligado" : "Desligado"}
                </Button>
              </div>
              <TemplateBlock eventId={eventId} kind="qr_delivery" templates={templates} withSubject />
            </Node>

            {/* 3. Antes do evento */}
            <Node
              icon={<Clock className="size-4" />}
              tone="bg-amber-500/15 text-amber-600"
              title="Antes do evento"
              meta={<Badge variant="secondary">{before.length} lembrete(s)</Badge>}
            >
              <div className="space-y-2">
                {before.map((r) => (
                  <ReminderRow key={r.id} eventId={eventId} rule={r} onChange={load} />
                ))}
                <Button variant="outline" size="sm" onClick={() => addRule("antes")}>
                  <Plus /> Adicionar lembrete antes
                </Button>
              </div>
            </Node>

            {/* 4. Depois do evento */}
            <Node
              icon={<CalendarClock className="size-4" />}
              tone="bg-violet-500/15 text-violet-600"
              title="Depois do evento"
              meta={<Badge variant="secondary">{after.length} mensagem(ns)</Badge>}
              last
            >
              <p className="mb-2 text-sm text-muted-foreground">
                Follow-up pós-evento: agradecimento, pesquisa/NPS ({`{{link_nps}}`}),
                certificado ({`{{link_certificado}}`}), próximos eventos…
              </p>
              <div className="space-y-2">
                {after.map((r) => (
                  <ReminderRow key={r.id} eventId={eventId} rule={r} onChange={load} />
                ))}
                <Button variant="outline" size="sm" onClick={() => addRule("depois")}>
                  <Plus /> Adicionar mensagem depois
                </Button>
              </div>
            </Node>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// Bloco de template fixo (registration / qr_delivery).
function TemplateBlock({
  eventId,
  kind,
  templates,
  withSubject,
}: {
  eventId: string;
  kind: string;
  templates: Tpl[];
  withSubject?: boolean;
}) {
  const initial = templates.find((t) => t.kind === kind);
  const [subject, setSubject] = useState(initial?.subject ?? "");
  const [body, setBody] = useState(initial?.body ?? "");
  const [saving, setSaving] = useState(false);
  const dirty = subject !== (initial?.subject ?? "") || body !== (initial?.body ?? "");

  async function save() {
    setSaving(true);
    const res = await fetch(`/api/events/${eventId}/templates`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, subject, body, active: true }),
    });
    setSaving(false);
    if (!res.ok) return toast.error("Erro ao salvar");
    toast.success("Mensagem salva");
  }

  return (
    <div className="rounded-lg border bg-card p-3">
      <MsgFields
        withSubject={withSubject}
        subject={subject}
        onSubject={setSubject}
        body={body}
        onBody={setBody}
      />
      <div className="mt-2 flex justify-end">
        <Button size="sm" onClick={save} disabled={saving || !dirty || !body.trim()}>
          {saving && <Loader2 className="size-4 animate-spin" />} Salvar
        </Button>
      </div>
    </div>
  );
}

// Linha editável de um lembrete/mensagem agendada.
function ReminderRow({
  eventId,
  rule,
  onChange,
}: {
  eventId: string;
  rule: Rule;
  onChange: () => void;
}) {
  const parts = offsetToParts(rule.offsetHours);
  const [dir, setDir] = useState<"antes" | "depois">(parts.dir);
  const [amount, setAmount] = useState(parts.amount);
  const [unit, setUnit] = useState<"horas" | "dias">(parts.unit);
  const [channel, setChannel] = useState(rule.channel);
  const [audience, setAudience] = useState(rule.audience);
  const [subject, setSubject] = useState(rule.subject ?? "");
  const [body, setBody] = useState(rule.body ?? "");
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState(false);

  async function save() {
    setSaving(true);
    const res = await fetch(`/api/events/${eventId}/reminders/${rule.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        offsetHours: partsToOffset(dir, amount, unit),
        channel,
        audience,
        subject,
        body,
      }),
    });
    setSaving(false);
    if (!res.ok) return toast.error("Erro ao salvar");
    toast.success("Agendamento salvo");
    onChange();
  }
  async function remove() {
    await fetch(`/api/events/${eventId}/reminders/${rule.id}`, { method: "DELETE" });
    onChange();
  }

  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          type="number"
          min={1}
          value={amount}
          onChange={(e) => setAmount(Math.max(1, Number(e.target.value) || 1))}
          className="h-8 w-16 text-sm"
        />
        <Select value={unit} onValueChange={(v) => setUnit(v as "horas" | "dias")}>
          <SelectTrigger className="h-8 w-24 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="horas">horas</SelectItem>
            <SelectItem value="dias">dias</SelectItem>
          </SelectContent>
        </Select>
        <Select value={dir} onValueChange={(v) => setDir(v as "antes" | "depois")}>
          <SelectTrigger className="h-8 w-28 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="antes">antes</SelectItem>
            <SelectItem value="depois">depois</SelectItem>
          </SelectContent>
        </Select>
        <Select value={channel} onValueChange={setChannel}>
          <SelectTrigger className="h-8 w-32 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            {CHANNELS.map((c) => <SelectItem key={c.v} value={c.v}>{c.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={audience} onValueChange={setAudience}>
          <SelectTrigger className="h-8 w-32 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            {AUDIENCES.map((a) => <SelectItem key={a.v} value={a.v}>{a.label}</SelectItem>)}
          </SelectContent>
        </Select>
        {rule.lastRunAt && <span className="text-xs text-success">enviado</span>}
        <div className="ml-auto flex items-center gap-1">
          <Button size="sm" variant="ghost" onClick={() => setExpanded((e) => !e)}>
            {expanded ? "Ocultar texto" : "Editar texto"}
          </Button>
          <Button size="icon-sm" variant="ghost" aria-label="Remover" onClick={remove}>
            <Trash2 className="text-destructive" />
          </Button>
        </div>
      </div>

      {expanded && (
        <div className="mt-3">
          <MsgFields
            withSubject={channel === "email"}
            subject={subject}
            onSubject={setSubject}
            body={body}
            onBody={setBody}
            placeholder="Texto próprio desta mensagem. Vazio = usa o template de Lembrete."
          />
        </div>
      )}

      <div className="mt-2 flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{timingLabel(partsToOffset(dir, amount, unit))} do início</span>
        <Button size="sm" onClick={save} disabled={saving}>
          {saving && <Loader2 className="size-4 animate-spin" />} Salvar
        </Button>
      </div>
    </div>
  );
}
