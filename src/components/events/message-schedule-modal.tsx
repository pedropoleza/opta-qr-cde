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
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
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

const VARIABLES = ["nome", "evento", "data", "hora", "local", "link_qr", "link_certificado", "link_nps", "valor"];

// Merge fields do GoHighLevel (usados quando a mensagem é enviada pelo GHL).
const GHL_VARIABLES: { t: string; l: string }[] = [
  { t: "{{contact.first_name}}", l: "Primeiro nome" },
  { t: "{{contact.full_name}}", l: "Nome completo" },
  { t: "{{contact.email}}", l: "E-mail" },
  { t: "{{contact.phone}}", l: "Telefone" },
  { t: "{{contact.event_name}}", l: "Evento" },
  { t: "{{contact.event_date}}", l: "Data" },
  { t: "{{contact.event_time}}", l: "Horário" },
  { t: "{{contact.event_location}}", l: "Local" },
  { t: "{{contact.event_qr_image}}", l: "Imagem do QR" },
  { t: "{{contact.event_qr_link}}", l: "Link do ingresso" },
  { t: "{{contact.event_pdf_link}}", l: "PDF do ingresso" },
  { t: "{{location.name}}", l: "Conta" },
  { t: "{{location.full_address}}", l: "Endereço da conta" },
];
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

type PhaseKey = "registration" | "payment" | "before" | "after";

function VarChips({ onPick }: { onPick: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {VARIABLES.map((v) => (
        <button
          key={v}
          type="button"
          onClick={() => onPick(v)}
          className="rounded-md border bg-muted/40 px-2 py-0.5 text-xs font-mono transition hover:bg-muted"
        >{`{{${v}}}`}</button>
      ))}
    </div>
  );
}

// Dropdown com os templates da conta GoHighLevel (snippets + templates de
// e-mail da seção de Marketing). Escolher um preenche o conteúdo.
type GhlTpl = { id: string; name: string; type: string; body: string | null };

function GhlTemplateDropdown({
  eventId,
  onImport,
}: {
  eventId: string;
  onImport: (body: string) => void;
}) {
  const [state, setState] = useState<{
    loading: boolean;
    connected: boolean;
    templates: GhlTpl[] | null;
  }>({ loading: false, connected: true, templates: null });

  async function load() {
    setState((s) => ({ ...s, loading: true }));
    const r = await fetch(`/api/events/${eventId}/ghl-templates`)
      .then((x) => x.json())
      .catch(() => ({ templates: [], connected: false }));
    setState({
      loading: false,
      connected: r.connected !== false,
      templates: r.templates ?? [],
    });
  }

  const typeLabel = (t: string) => (t === "email" ? "E-mail" : "Snippet");

  return (
    <Select
      onOpenChange={(o) => {
        if (o && state.templates === null) load();
      }}
      onValueChange={(id) => {
        const t = state.templates?.find((x) => x.id === id);
        if (!t) return;
        if (t.body && t.body.trim()) {
          onImport(t.body);
          toast.success(`Template “${t.name}” carregado`);
        } else {
          toast.info(`“${t.name}” selecionado — sem conteúdo importável (edite aqui).`);
        }
      }}
    >
      <SelectTrigger className="h-8 w-56 text-xs">
        <SelectValue placeholder="Template do GoHighLevel…" />
      </SelectTrigger>
      <SelectContent>
        {state.loading && (
          <div className="px-2 py-2 text-xs text-muted-foreground">Carregando…</div>
        )}
        {!state.loading && !state.connected && (
          <div className="px-2 py-2 text-xs text-muted-foreground">
            GoHighLevel não conectado.
          </div>
        )}
        {!state.loading && state.connected && state.templates?.length === 0 && (
          <div className="px-2 py-2 text-xs text-muted-foreground">Nenhum template.</div>
        )}
        {state.templates?.map((t) => (
          <SelectItem key={`${t.type}:${t.id}`} value={t.id}>
            <span className="flex items-center gap-2">
              <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase text-muted-foreground">
                {typeLabel(t.type)}
              </span>
              {t.name}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function MsgFields({
  eventId,
  subject,
  onSubject,
  body,
  onBody,
  withSubject,
  placeholder,
}: {
  eventId: string;
  subject?: string;
  onSubject?: (v: string) => void;
  body: string;
  onBody: (v: string) => void;
  withSubject?: boolean;
  placeholder?: string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-medium text-muted-foreground">Conteúdo</span>
        <GhlTemplateDropdown eventId={eventId} onImport={onBody} />
      </div>
      {withSubject && (
        <Input
          value={subject ?? ""}
          onChange={(e) => onSubject?.(e.target.value)}
          placeholder="Assunto (e-mail) — ex.: Seu ingresso {{evento}}"
          className="text-sm"
        />
      )}
      <Textarea
        rows={4}
        value={body}
        onChange={(e) => onBody(e.target.value)}
        placeholder={placeholder ?? "Escreva a mensagem… use as variáveis abaixo."}
        className="text-sm"
      />
      <div className="space-y-1.5">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Variáveis do app</p>
        <VarChips onPick={(v) => onBody(`${body}${body && !body.endsWith(" ") ? " " : ""}{{${v}}}`)} />
      </div>
      <div className="space-y-1.5">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Variáveis do GoHighLevel</p>
        <div className="flex flex-wrap gap-1.5">
          {GHL_VARIABLES.map((v) => (
            <button
              key={v.t}
              type="button"
              title={v.t}
              onClick={() => onBody(`${body}${body && !body.endsWith(" ") ? " " : ""}${v.t}`)}
              className="rounded-md border border-primary/30 bg-primary/5 px-2 py-0.5 text-xs text-primary transition hover:bg-primary/10"
            >
              {v.l}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// Cabeçalho de painel (lado direito).
function PaneHeader({
  icon,
  tone,
  title,
  desc,
  right,
}: {
  icon: React.ReactNode;
  tone: string;
  title: string;
  desc: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="mb-5 flex items-start gap-3">
      <span className={`flex size-11 shrink-0 items-center justify-center rounded-xl ${tone}`}>
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <h3 className="text-lg font-semibold leading-tight">{title}</h3>
        <p className="mt-0.5 text-sm text-muted-foreground">{desc}</p>
      </div>
      {right}
    </div>
  );
}

// Conteúdo da agenda (usado dentro do modal e no fluxo de criação de evento).
export function MessageScheduleContent({
  eventId,
  eventName,
  heightClass = "h-[85vh]",
}: {
  eventId: string;
  eventName?: string;
  heightClass?: string;
}) {
  const [loading, setLoading] = useState(false);
  const [phase, setPhase] = useState<PhaseKey>("registration");
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
    load();
  }, [load]);

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

  const NAV: {
    key: PhaseKey;
    icon: React.ReactNode;
    tone: string;
    title: string;
    sub: string;
  }[] = [
    {
      key: "registration",
      icon: <UserPlus className="size-4" />,
      tone: "bg-sky-500/15 text-sky-600",
      title: "No cadastro",
      sub: integ?.sendMsgOnRegistration ? "Ativo" : "Desativado",
    },
    {
      key: "payment",
      icon: <CreditCard className="size-4" />,
      tone: "bg-emerald-500/15 text-emerald-600",
      title: "No pagamento",
      sub: integ?.autoSendQrOnPaid ? "Automático" : "Manual",
    },
    {
      key: "before",
      icon: <Clock className="size-4" />,
      tone: "bg-amber-500/15 text-amber-600",
      title: "Antes do evento",
      sub: `${before.length} lembrete(s)`,
    },
    {
      key: "after",
      icon: <CalendarClock className="size-4" />,
      tone: "bg-violet-500/15 text-violet-600",
      title: "Depois do evento",
      sub: `${after.length} mensagem(ns)`,
    },
  ];

  return (
    <div className={`flex ${heightClass} min-h-0 flex-col md:flex-row`}>
          {/* Navegação de fases */}
          <aside className="shrink-0 overflow-x-auto border-b bg-muted/30 p-4 md:h-full md:w-72 md:overflow-y-auto md:border-b-0 md:border-r">
            <div className="mb-4 space-y-1 text-left">
              <h2 className="text-base font-medium">Agenda de mensagens</h2>
              <p className="text-xs text-muted-foreground">
                {eventName ? eventName : "Jornada de comunicação do convidado."}
              </p>
            </div>
            <nav className="flex gap-2 overflow-x-auto md:flex-col md:overflow-visible">
              {NAV.map((n) => {
                const active = phase === n.key;
                return (
                  <button
                    key={n.key}
                    type="button"
                    onClick={() => setPhase(n.key)}
                    className={`flex shrink-0 items-center gap-3 rounded-xl px-3 py-2.5 text-left transition ${
                      active
                        ? "bg-background shadow-sm ring-1 ring-border"
                        : "hover:bg-background/60"
                    }`}
                  >
                    <span className={`flex size-8 items-center justify-center rounded-lg ${n.tone}`}>
                      {n.icon}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-medium leading-tight">{n.title}</span>
                      <span className="block text-xs text-muted-foreground">{n.sub}</span>
                    </span>
                    <ChevronRight
                      className={`ml-auto hidden size-4 text-muted-foreground md:block ${active ? "opacity-100" : "opacity-0"}`}
                    />
                  </button>
                );
              })}
            </nav>
          </aside>

          {/* Painel da fase */}
          <div className="min-h-0 flex-1 overflow-y-auto p-5 pb-16 md:p-7 md:pb-20">
            {loading ? (
              <div className="flex items-center justify-center py-24 text-muted-foreground">
                <Loader2 className="mr-2 size-4 animate-spin" /> Carregando…
              </div>
            ) : phase === "registration" ? (
              <div>
                <PaneHeader
                  icon={<UserPlus className="size-5" />}
                  tone="bg-sky-500/15 text-sky-600"
                  title="No cadastro"
                  desc="Enviada assim que a pessoa se inscreve, antes do pagamento."
                  right={
                    <Badge variant={integ?.sendMsgOnRegistration ? "default" : "outline"}>
                      {integ?.sendMsgOnRegistration ? "Ativo" : "Desativado"}
                    </Badge>
                  }
                />
                <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border bg-muted/20 p-3">
                  <span className="text-sm font-medium">Enviar ao se inscrever</span>
                  <Button
                    size="sm"
                    variant={integ?.sendMsgOnRegistration ? "default" : "outline"}
                    onClick={() => patchInteg({ sendMsgOnRegistration: !integ?.sendMsgOnRegistration })}
                  >
                    {integ?.sendMsgOnRegistration ? "Ligado" : "Desligado"}
                  </Button>
                  <span className="ml-auto text-sm text-muted-foreground">Canal</span>
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
              </div>
            ) : phase === "payment" ? (
              <div>
                <PaneHeader
                  icon={<CreditCard className="size-5" />}
                  tone="bg-emerald-500/15 text-emerald-600"
                  title="No pagamento"
                  desc="Entrega o ingresso (PDF + QR) automaticamente quando o pagamento é confirmado."
                  right={
                    <Badge variant={integ?.autoSendQrOnPaid ? "default" : "outline"}>
                      {integ?.autoSendQrOnPaid ? "Automático" : "Manual"}
                    </Badge>
                  }
                />
                <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border bg-muted/20 p-3">
                  <span className="text-sm font-medium">Envio automático ao pagar</span>
                  <Button
                    size="sm"
                    variant={integ?.autoSendQrOnPaid ? "default" : "outline"}
                    onClick={() => patchInteg({ autoSendQrOnPaid: !integ?.autoSendQrOnPaid })}
                  >
                    {integ?.autoSendQrOnPaid ? "Ligado" : "Desligado"}
                  </Button>
                  <span className="ml-auto rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">
                    Canal: {CHANNELS.find((c) => c.v === integ?.sendChannel)?.label ?? integ?.sendChannel}
                  </span>
                </div>
                <TemplateBlock eventId={eventId} kind="qr_delivery" templates={templates} withSubject />
              </div>
            ) : phase === "before" ? (
              <div>
                <PaneHeader
                  icon={<Clock className="size-5" />}
                  tone="bg-amber-500/15 text-amber-600"
                  title="Antes do evento"
                  desc="Lembretes agendados relativos ao início do evento (dias/horas antes)."
                  right={<Badge variant="secondary">{before.length}</Badge>}
                />
                <div className="space-y-3">
                  {before.map((r) => (
                    <ReminderRow key={r.id} eventId={eventId} rule={r} onChange={load} />
                  ))}
                  {before.length === 0 && (
                    <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
                      Nenhum lembrete antes do evento ainda.
                    </p>
                  )}
                  <Button variant="outline" onClick={() => addRule("antes")}>
                    <Plus /> Adicionar lembrete antes
                  </Button>
                </div>
              </div>
            ) : (
              <div>
                <PaneHeader
                  icon={<CalendarClock className="size-5" />}
                  tone="bg-violet-500/15 text-violet-600"
                  title="Depois do evento"
                  desc="Follow-up pós-evento: agradecimento, pesquisa/NPS, certificado, próximos eventos."
                  right={<Badge variant="secondary">{after.length}</Badge>}
                />
                <div className="space-y-3">
                  {after.map((r) => (
                    <ReminderRow key={r.id} eventId={eventId} rule={r} onChange={load} />
                  ))}
                  {after.length === 0 && (
                    <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
                      Nenhuma mensagem depois do evento ainda.
                    </p>
                  )}
                  <Button variant="outline" onClick={() => addRule("depois")}>
                    <Plus /> Adicionar mensagem depois
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
  );
}

// Modal: botão "Agenda de mensagens" que abre o conteúdo acima.
export function MessageScheduleModal({
  eventId,
  eventName,
}: {
  eventId: string;
  eventName?: string;
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button>
          <CalendarClock /> Agenda de mensagens
        </Button>
      </DialogTrigger>
      <DialogContent className="w-[96vw] max-w-6xl gap-0 overflow-hidden p-0 sm:max-w-6xl">
        <DialogTitle className="sr-only">Agenda de mensagens</DialogTitle>
        <MessageScheduleContent eventId={eventId} eventName={eventName} />
      </DialogContent>
    </Dialog>
  );
}

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
    <div className="rounded-xl border bg-card p-4">
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Conteúdo da mensagem
      </p>
      <MsgFields
        eventId={eventId}
        withSubject={withSubject}
        subject={subject}
        onSubject={setSubject}
        body={body}
        onBody={setBody}
      />
      <div className="mt-3 flex justify-end">
        <Button size="sm" onClick={save} disabled={saving || !dirty || !body.trim()}>
          {saving && <Loader2 className="size-4 animate-spin" />} Salvar
        </Button>
      </div>
    </div>
  );
}

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
    <div className="rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          type="number"
          min={1}
          value={amount}
          onChange={(e) => setAmount(Math.max(1, Number(e.target.value) || 1))}
          className="h-9 w-16 text-sm"
        />
        <Select value={unit} onValueChange={(v) => setUnit(v as "horas" | "dias")}>
          <SelectTrigger className="h-9 w-24 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="horas">horas</SelectItem>
            <SelectItem value="dias">dias</SelectItem>
          </SelectContent>
        </Select>
        <Select value={dir} onValueChange={(v) => setDir(v as "antes" | "depois")}>
          <SelectTrigger className="h-9 w-28 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="antes">antes</SelectItem>
            <SelectItem value="depois">depois</SelectItem>
          </SelectContent>
        </Select>
        <span className="mx-1 hidden text-xs text-muted-foreground sm:inline">·</span>
        <Select value={channel} onValueChange={setChannel}>
          <SelectTrigger className="h-9 w-32 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            {CHANNELS.map((c) => <SelectItem key={c.v} value={c.v}>{c.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={audience} onValueChange={setAudience}>
          <SelectTrigger className="h-9 w-32 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            {AUDIENCES.map((a) => <SelectItem key={a.v} value={a.v}>{a.label}</SelectItem>)}
          </SelectContent>
        </Select>
        {rule.lastRunAt && (
          <Badge className="border-transparent bg-success text-success-foreground">enviado</Badge>
        )}
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
        <div className="mt-4 border-t pt-4">
          <MsgFields
            eventId={eventId}
            withSubject={channel === "email"}
            subject={subject}
            onSubject={setSubject}
            body={body}
            onBody={setBody}
            placeholder="Texto próprio desta mensagem. Vazio = usa o template de Lembrete."
          />
        </div>
      )}

      <div className="mt-3 flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {timingLabel(partsToOffset(dir, amount, unit))} do início do evento
        </span>
        <Button size="sm" onClick={save} disabled={saving}>
          {saving && <Loader2 className="size-4 animate-spin" />} Salvar
        </Button>
      </div>
    </div>
  );
}
