"use client";

import { useEffect, useState } from "react";
import { Mail, MessageCircle, Plus, Trash2, Copy } from "lucide-react";
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

// Persiste o rascunho no evento recém-criado.
export async function saveMessageDraft(eventId: string, d: MsgDraft) {
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
  for (const r of d.reminders) {
    await fetch(`/api/events/${eventId}/reminders`, {
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
}

// ---- UI ----
function ChannelPills({ value, onChange }: { value: Ch; onChange: (c: Ch) => void }) {
  return (
    <div className="inline-flex rounded-lg border bg-muted/40 p-0.5">
      {(
        [
          { v: "email" as Ch, label: "E-mail", icon: <Mail className="size-3.5" /> },
          { v: "whatsapp" as Ch, label: "WhatsApp / SMS", icon: <MessageCircle className="size-3.5" /> },
        ]
      ).map((c) => (
        <button
          key={c.v}
          type="button"
          onClick={() => onChange(c.v)}
          className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition ${
            value === c.v ? "bg-background shadow-sm" : "text-muted-foreground"
          }`}
        >
          {c.icon} {c.label}
        </button>
      ))}
    </div>
  );
}

function GhlDropdown({ channel, onPick }: { channel: Ch; onPick: (body: string) => void }) {
  const [tpls, setTpls] = useState<{ id: string; name: string; body: string | null }[] | null>(null);
  const [connected, setConnected] = useState(true);
  async function load() {
    const type = channel === "whatsapp" ? "sms" : "email";
    const r = await fetch(`/api/ghl/templates?type=${type}`).then((x) => x.json()).catch(() => ({ templates: [], connected: false }));
    setConnected(r.connected !== false);
    setTpls(r.templates ?? []);
  }
  return (
    <Select
      onOpenChange={(o) => o && tpls === null && load()}
      onValueChange={(id) => {
        const t = tpls?.find((x) => x.id === id);
        if (t?.body?.trim()) { onPick(t.body); toast.success("Template carregado"); }
        else if (t) toast.info(`“${t.name}” selecionado (sem texto importável)`);
      }}
    >
      <SelectTrigger className="h-7 w-48 text-xs"><SelectValue placeholder="Template do GHL…" /></SelectTrigger>
      <SelectContent>
        {tpls === null && <div className="px-2 py-1.5 text-xs text-muted-foreground">Abrir para carregar…</div>}
        {tpls && !connected && <div className="px-2 py-1.5 text-xs text-muted-foreground">GHL não conectado.</div>}
        {tpls && connected && tpls.length === 0 && <div className="px-2 py-1.5 text-xs text-muted-foreground">Nenhum template.</div>}
        {tpls?.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
      </SelectContent>
    </Select>
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

function Block({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="font-medium">{title}</p>
      {hint && <p className="mb-3 text-xs text-muted-foreground">{hint}</p>}
      <div className={hint ? "" : "mt-3"}>{children}</div>
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
    const [t, r, i] = await Promise.all([
      fetch(`/api/events/${srcId}/templates`).then((x) => (x.ok ? x.json() : { templates: [] })),
      fetch(`/api/events/${srcId}/reminders`).then((x) => (x.ok ? x.json() : { rules: [] })),
      fetch(`/api/events/${srcId}/integration`).then((x) => (x.ok ? x.json() : null)),
    ]);
    const tpl = (k: string) => (t.templates ?? []).find((x: { kind: string }) => x.kind === k);
    const reg = tpl("registration");
    const pay = tpl("qr_delivery");
    onChange({
      regOn: i?.sendMsgOnRegistration ?? false,
      regChannel: (i?.registrationChannel as Ch) ?? "whatsapp",
      regSubject: reg?.subject ?? "",
      regBody: reg?.body ?? "",
      payChannel: (i?.sendChannel === "email" ? "email" : "whatsapp") as Ch,
      paySubject: pay?.subject ?? "",
      payBody: pay?.body ?? "",
      reminders: (r.rules ?? []).map((rule: { offsetHours: number; channel: string; subject: string | null; body: string | null }, idx: number) => {
        const abs = Math.abs(rule.offsetHours);
        return {
          id: idx + 1,
          dir: rule.offsetHours <= 0 ? "antes" : "depois",
          amount: abs % 24 === 0 && abs !== 0 ? abs / 24 : abs || 1,
          unit: abs % 24 === 0 && abs !== 0 ? "dias" : "horas",
          channel: (rule.channel === "email" ? "email" : "whatsapp") as Ch,
          subject: rule.subject ?? "",
          body: rule.body ?? "",
        };
      }),
    });
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

      <Block title="No cadastro" hint="Enviada quando a pessoa se inscreve.">
        <div className="mb-3">
          <button
            type="button"
            onClick={() => set({ regOn: !value.regOn })}
            className={`rounded-md px-3 py-1 text-xs font-medium ${value.regOn ? "bg-primary text-primary-foreground" : "border bg-background text-muted-foreground"}`}
          >
            {value.regOn ? "Ativo" : "Desativado"}
          </button>
        </div>
        {value.regOn && (
          <Content
            channel={value.regChannel}
            onChannel={(c) => set({ regChannel: c })}
            subject={value.regSubject}
            onSubject={(v) => set({ regSubject: v })}
            body={value.regBody}
            onBody={(v) => set({ regBody: v })}
          />
        )}
      </Block>

      <Block title="No pagamento" hint="Entrega o ingresso quando o pagamento é confirmado.">
        <Content
          channel={value.payChannel}
          onChannel={(c) => set({ payChannel: c })}
          subject={value.paySubject}
          onSubject={(v) => set({ paySubject: v })}
          body={value.payBody}
          onBody={(v) => set({ payBody: v })}
        />
      </Block>

      <Block title="Lembretes" hint="Antes ou depois do evento.">
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
