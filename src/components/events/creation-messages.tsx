"use client";

import { useEffect, useState } from "react";
import {
  Mail,
  MessageCircle,
  Plus,
  Trash2,
  Copy,
  UserPlus,
  CreditCard,
  Clock,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Ch = "email" | "whatsapp";
type Reminder = {
  id: number;
  dir: "antes" | "depois";
  amount: number;
  unit: "horas" | "dias";
  channel: Ch;
  subject: string;
  body: string;
};
export type MsgDraft = {
  regOn: boolean;
  regChannel: Ch;
  regSubject: string;
  regBody: string;
  payChannel: Ch;
  paySubject: string;
  payBody: string;
  reminders: Reminder[];
};

export const emptyDraft: MsgDraft = {
  regOn: false,
  regChannel: "whatsapp",
  regSubject: "",
  regBody: "",
  payChannel: "whatsapp",
  paySubject: "",
  payBody: "",
  reminders: [],
};

const APP_VARS = ["nome", "evento", "data", "hora", "local", "link_qr"];
const GHL_VARS = [
  { t: "{{contact.first_name}}", l: "Primeiro nome" },
  { t: "{{contact.event_qr_image}}", l: "Imagem QR" },
  { t: "{{contact.event_qr_link}}", l: "Link ingresso" },
  { t: "{{contact.event_pdf_link}}", l: "PDF ingresso" },
];

function toOffset(r: Reminder) {
  const h = (r.amount || 1) * (r.unit === "dias" ? 24 : 1);
  return r.dir === "antes" ? -h : h;
}

async function saveBase(eventId: string, d: MsgDraft) {
  await fetch(`/api/events/${eventId}/integration`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sendMsgOnRegistration: d.regOn,
      registrationChannel: d.regChannel,
      sendChannel: d.payChannel,
    }),
  }).catch(() => {});
  const putTpl = (kind: string, subject: string, body: string) =>
    body.trim()
      ? fetch(`/api/events/${eventId}/templates`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ kind, subject, body, active: true }),
        }).catch(() => {})
      : Promise.resolve();
  await putTpl("registration", d.regSubject, d.regBody);
  await putTpl("qr_delivery", d.paySubject, d.payBody);
}

function postReminder(eventId: string, r: Reminder) {
  return fetch(`/api/events/${eventId}/reminders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      offsetHours: toOffset(r),
      channel: r.channel,
      audience: "paid",
      subject: r.subject,
      body: r.body,
    }),
  }).catch(() => {});
}

// Criação: persiste o rascunho (adiciona todos os lembretes).
export async function saveMessageDraft(eventId: string, d: MsgDraft) {
  await saveBase(eventId, d);
  for (const r of d.reminders) await postReminder(eventId, r);
}

// Edição de evento existente: substitui os lembretes (evita duplicar ao reeditar).
export async function replaceMessages(eventId: string, d: MsgDraft) {
  await saveBase(eventId, d);
  const cur = await fetch(`/api/events/${eventId}/reminders`)
    .then((x) => (x.ok ? x.json() : { rules: [] }))
    .catch(() => ({ rules: [] }));
  await Promise.all(
    (cur.rules ?? []).map((rule: { id: string }) =>
      fetch(`/api/events/${eventId}/reminders/${rule.id}`, { method: "DELETE" }).catch(() => {}),
    ),
  );
  for (const r of d.reminders) await postReminder(eventId, r);
}

// Carrega a config atual de um evento no formato do rascunho.
export async function loadDraftFromEvent(srcId: string): Promise<MsgDraft> {
  const [t, r, i] = await Promise.all([
    fetch(`/api/events/${srcId}/templates`).then((x) => (x.ok ? x.json() : { templates: [] })),
    fetch(`/api/events/${srcId}/reminders`).then((x) => (x.ok ? x.json() : { rules: [] })),
    fetch(`/api/events/${srcId}/integration`).then((x) => (x.ok ? x.json() : null)),
  ]);
  const tpl = (k: string) => (t.templates ?? []).find((x: { kind: string }) => x.kind === k);
  const reg = tpl("registration");
  const pay = tpl("qr_delivery");
  return {
    regOn: i?.sendMsgOnRegistration ?? false,
    regChannel: (i?.registrationChannel as Ch) ?? "whatsapp",
    regSubject: reg?.subject ?? "",
    regBody: reg?.body ?? "",
    payChannel: (i?.sendChannel === "email" ? "email" : "whatsapp") as Ch,
    paySubject: pay?.subject ?? "",
    payBody: pay?.body ?? "",
    reminders: (r.rules ?? []).map(
      (rule: { offsetHours: number; channel: string; subject: string | null; body: string | null }, idx: number) => {
        const abs = Math.abs(rule.offsetHours);
        return {
          id: idx + 1,
          dir: (rule.offsetHours <= 0 ? "antes" : "depois") as "antes" | "depois",
          amount: abs % 24 === 0 && abs !== 0 ? abs / 24 : abs || 1,
          unit: (abs % 24 === 0 && abs !== 0 ? "dias" : "horas") as "horas" | "dias",
          channel: (rule.channel === "email" ? "email" : "whatsapp") as Ch,
          subject: rule.subject ?? "",
          body: rule.body ?? "",
        };
      },
    ),
  };
}

// ---- UI ----
function ChannelPills({ value, onChange }: { value: Ch; onChange: (c: Ch) => void }) {
  const opts = [
    { v: "email" as Ch, label: "E-mail", icon: <Mail className="size-3.5" />, on: "bg-sky-500 text-white shadow-sm" },
    { v: "whatsapp" as Ch, label: "WhatsApp / SMS", icon: <MessageCircle className="size-3.5" />, on: "bg-emerald-500 text-white shadow-sm" },
  ];
  return (
    <div className="inline-flex rounded-lg border bg-muted/40 p-0.5">
      {opts.map((c) => {
        const active = value === c.v;
        return (
          <button
            key={c.v}
            type="button"
            onClick={() => onChange(c.v)}
            className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition ${
              active ? c.on : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {active ? <Check className="size-3.5" /> : c.icon} {c.label}
          </button>
        );
      })}
    </div>
  );
}

function GhlDropdown({ channel, onPick }: { channel: Ch; onPick: (body: string) => void }) {
  const [tpls, setTpls] = useState<{ id: string; name: string; body: string | null }[] | null>(null);
  const [connected, setConnected] = useState(true);
  const [picked, setPicked] = useState<string | null>(null);
  async function load() {
    const type = channel === "whatsapp" ? "sms" : "email";
    const r = await fetch(`/api/ghl/templates?type=${type}`).then((x) => x.json()).catch(() => ({ templates: [], connected: false }));
    setConnected(r.connected !== false);
    setTpls(r.templates ?? []);
  }
  return (
    <div className="flex items-center gap-2">
      {picked && (
        <span className="flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-700">
          <Check className="size-3" /> {picked}
        </span>
      )}
      <Select
        onOpenChange={(o) => o && tpls === null && load()}
        onValueChange={(id) => {
          const t = tpls?.find((x) => x.id === id);
          if (!t) return;
          setPicked(t.name);
          if (t.body?.trim()) { onPick(t.body); toast.success(`Template “${t.name}” carregado`); }
          else toast.info(`“${t.name}” selecionado (sem texto importável)`);
        }}
      >
        <SelectTrigger className="h-7 w-44 text-xs"><SelectValue placeholder="Template do GHL…" /></SelectTrigger>
        <SelectContent>
          {tpls === null && <div className="px-2 py-1.5 text-xs text-muted-foreground">Abrir para carregar…</div>}
          {tpls && !connected && <div className="px-2 py-1.5 text-xs text-muted-foreground">GHL não conectado.</div>}
          {tpls && connected && tpls.length === 0 && <div className="px-2 py-1.5 text-xs text-muted-foreground">Nenhum template.</div>}
          {tpls?.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}

function Content({
  channel,
  onChannel,
  subject,
  onSubject,
  body,
  onBody,
}: {
  channel: Ch;
  onChannel: (c: Ch) => void;
  subject: string;
  onSubject: (v: string) => void;
  body: string;
  onBody: (v: string) => void;
}) {
  const add = (t: string) => onBody(`${body}${body && !body.endsWith(" ") ? " " : ""}${t}`);
  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <ChannelPills value={channel} onChange={onChannel} />
        <GhlDropdown channel={channel} onPick={onBody} />
      </div>
      {channel === "email" && (
        <Input value={subject} onChange={(e) => onSubject(e.target.value)} placeholder="Assunto do e-mail" className="text-sm" />
      )}
      <Textarea value={body} onChange={(e) => onBody(e.target.value)} rows={3} placeholder="Escreva a mensagem…" className="text-sm" />
      <div className="flex flex-wrap gap-1.5">
        {APP_VARS.map((v) => (
          <button key={v} type="button" onClick={() => add(`{{${v}}}`)} className="rounded-md border bg-muted/40 px-2 py-0.5 text-xs font-mono hover:bg-muted">{`{{${v}}}`}</button>
        ))}
        {GHL_VARS.map((v) => (
          <button key={v.t} type="button" title={v.t} onClick={() => add(v.t)} className="rounded-md border border-primary/30 bg-primary/5 px-2 py-0.5 text-xs text-primary hover:bg-primary/10">{v.l}</button>
        ))}
      </div>
    </div>
  );
}

function Block({
  icon,
  tone,
  title,
  hint,
  badge,
  children,
}: {
  icon: React.ReactNode;
  tone: string;
  title: string;
  hint?: string;
  badge?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <div className={`flex items-center gap-3 border-b px-4 py-3 ${tone}`}>
        <span className="flex size-9 items-center justify-center rounded-lg bg-background/70 shadow-sm">
          {icon}
        </span>
        <div className="min-w-0">
          <p className="font-semibold leading-tight">{title}</p>
          {hint && <p className="text-xs opacity-80">{hint}</p>}
        </div>
        {badge && <div className="ml-auto">{badge}</div>}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

export function CreationMessages({
  value,
  onChange,
}: {
  value: MsgDraft;
  onChange: (d: MsgDraft) => void;
}) {
  const [events, setEvents] = useState<{ id: string; name: string }[]>([]);
  const set = (patch: Partial<MsgDraft>) => onChange({ ...value, ...patch });

  useEffect(() => {
    fetch("/api/events")
      .then((r) => (r.ok ? r.json() : { events: [] }))
      .then((d) => setEvents((d.events ?? []).map((e: { id: string; name: string }) => ({ id: e.id, name: e.name }))))
      .catch(() => {});
  }, []);

  async function copyFrom(srcId: string) {
    onChange(await loadDraftFromEvent(srcId));
    toast.success("Mensagens copiadas");
  }

  function addReminder(dir: "antes" | "depois") {
    set({
      reminders: [
        ...value.reminders,
        { id: Date.now(), dir, amount: 1, unit: "dias", channel: "whatsapp", subject: "", body: "" },
      ],
    });
  }
  function updateReminder(id: number, patch: Partial<Reminder>) {
    set({ reminders: value.reminders.map((r) => (r.id === id ? { ...r, ...patch } : r)) });
  }
  function removeReminder(id: number) {
    set({ reminders: value.reminders.filter((r) => r.id !== id) });
  }

  return (
    <div className="space-y-4">
      {/* Copiar de outro evento */}
      {events.length > 0 && (
        <div className="flex items-center gap-2 rounded-xl border border-dashed bg-muted/20 p-3">
          <Copy className="size-4 text-muted-foreground" />
          <span className="text-sm">Copiar mensagens de outro evento</span>
          <Select onValueChange={copyFrom}>
            <SelectTrigger className="ml-auto h-8 w-56 text-xs"><SelectValue placeholder="Escolher evento…" /></SelectTrigger>
            <SelectContent>
              {events.map((e) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}

      <Block
        icon={<UserPlus className="size-4 text-sky-600" />}
        tone="bg-sky-500/10"
        title="Confirmação no cadastro"
        hint="Enviada quando a pessoa se inscreve."
        badge={
          <button
            type="button"
            onClick={() => set({ regOn: !value.regOn })}
            className={`flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold transition ${
              value.regOn
                ? "bg-emerald-500 text-white shadow-sm"
                : "border bg-background text-muted-foreground"
            }`}
          >
            {value.regOn ? <><Check className="size-3" /> Ativo</> : "Desativado"}
          </button>
        }
      >
        {value.regOn ? (
          <Content
            channel={value.regChannel}
            onChannel={(c) => set({ regChannel: c })}
            subject={value.regSubject}
            onSubject={(v) => set({ regSubject: v })}
            body={value.regBody}
            onBody={(v) => set({ regBody: v })}
          />
        ) : (
          <p className="text-sm text-muted-foreground">Ative para configurar a mensagem de confirmação.</p>
        )}
      </Block>

      <Block
        icon={<CreditCard className="size-4 text-emerald-600" />}
        tone="bg-emerald-500/10"
        title="No pagamento"
        hint="Entrega o ingresso quando o pagamento é confirmado."
      >
        <Content
          channel={value.payChannel}
          onChannel={(c) => set({ payChannel: c })}
          subject={value.paySubject}
          onSubject={(v) => set({ paySubject: v })}
          body={value.payBody}
          onBody={(v) => set({ payBody: v })}
        />
      </Block>

      <Block
        icon={<Clock className="size-4 text-amber-600" />}
        tone="bg-amber-500/10"
        title="Lembretes"
        hint="Antes ou depois do evento."
        badge={
          value.reminders.length > 0 ? (
            <span className="rounded-full bg-background/70 px-2.5 py-1 text-xs font-medium shadow-sm">
              {value.reminders.length}
            </span>
          ) : undefined
        }
      >
        <div className="space-y-3">
          {value.reminders.map((r) => (
            <div key={r.id} className="rounded-lg border p-3">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <Input type="number" min={1} value={r.amount} onChange={(e) => updateReminder(r.id, { amount: Math.max(1, Number(e.target.value) || 1) })} className="h-8 w-16 text-sm" />
                <Select value={r.unit} onValueChange={(v) => updateReminder(r.id, { unit: v as "horas" | "dias" })}>
                  <SelectTrigger className="h-8 w-24 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="horas">horas</SelectItem><SelectItem value="dias">dias</SelectItem></SelectContent>
                </Select>
                <Select value={r.dir} onValueChange={(v) => updateReminder(r.id, { dir: v as "antes" | "depois" })}>
                  <SelectTrigger className="h-8 w-28 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="antes">antes</SelectItem><SelectItem value="depois">depois</SelectItem></SelectContent>
                </Select>
                <button type="button" onClick={() => removeReminder(r.id)} className="ml-auto text-muted-foreground hover:text-destructive">
                  <Trash2 className="size-4" />
                </button>
              </div>
              <Content
                channel={r.channel}
                onChannel={(c) => updateReminder(r.id, { channel: c })}
                subject={r.subject}
                onSubject={(v) => updateReminder(r.id, { subject: v })}
                body={r.body}
                onBody={(v) => updateReminder(r.id, { body: v })}
              />
            </div>
          ))}
          <div className="flex gap-2">
            <button type="button" onClick={() => addReminder("antes")} className="flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs hover:bg-accent">
              <Plus className="size-3.5" /> Antes
            </button>
            <button type="button" onClick={() => addReminder("depois")} className="flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs hover:bg-accent">
              <Plus className="size-3.5" /> Depois
            </button>
          </div>
        </div>
      </Block>
    </div>
  );
}
