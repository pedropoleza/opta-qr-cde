"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Check,
  Copy,
  CreditCard,
  Link2,
  Loader2,
  DollarSign,
  Clock,
  AlertTriangle,
  XCircle,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Segmented } from "@/components/ui/segmented";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { GuestRow } from "@/components/events/event-detail";
import {
  PAYMENT_STATUS_SHORT,
  PAYMENT_STATUS_TONE,
} from "@/lib/payment-status";

type Config = {
  registrationUrl: string;
  squareUrl: string;
  leadUrl: string | null;
  hasSignatureKey: boolean;
  autoSendQrOnPaid: boolean;
  sendChannel: string;
  priceCents: number | null;
  currency: string;
  paymentReminderEnabled: boolean;
  paymentReminderMinutes: number;
  paymentReminderMessage: string | null;
  active: boolean;
};

const PAY_LABEL = PAYMENT_STATUS_SHORT;
const PAY_TONE = PAYMENT_STATUS_TONE;

function money(cents: number, currency: string) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: currency || "BRL" }).format(
    cents / 100,
  );
}

function Metric({
  icon,
  tone,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  tone: string;
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <Card className="transition hover:shadow-sm">
      <CardContent className="flex items-start gap-3.5 p-5">
        <span className={`flex size-11 shrink-0 items-center justify-center rounded-xl ${tone}`}>
          {icon}
        </span>
        <div className="min-w-0">
          <p className="truncate text-[1.7rem] font-bold leading-none tracking-tight">{value}</p>
          <p className="mt-1 text-sm font-medium">{label}</p>
          {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div className="flex items-center gap-2">
        <Input readOnly value={value} className="font-mono text-xs" />
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="Copiar"
          onClick={() => {
            navigator.clipboard.writeText(value);
            setCopied(true);
            toast.success("Copiado");
            setTimeout(() => setCopied(false), 1500);
          }}
        >
          {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
        </Button>
      </div>
    </div>
  );
}

export function PaymentsTab({
  eventId,
  guests,
  eventDate,
  onChange,
}: {
  eventId: string;
  guests: GuestRow[];
  eventDate: string;
  onChange: () => void;
}) {
  const [view, setView] = useState("overview");
  const [cfg, setCfg] = useState<Config | null>(null);
  const [sigKey, setSigKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  async function load() {
    const res = await fetch(`/api/events/${eventId}/integration`);
    if (res.ok) setCfg(await res.json());
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  async function patch(body: Record<string, unknown>, msg?: string) {
    setSaving(true);
    const res = await fetch(`/api/events/${eventId}/integration`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setSaving(false);
    if (!res.ok) return toast.error("Erro ao salvar");
    if (msg) toast.success(msg);
    load();
  }

  const active = guests.filter((g) => g.status !== "canceled");
  const eventPassed = new Date(eventDate) < new Date(new Date().toDateString());

  const stats = useMemo(() => {
    const paid = active.filter((g) => g.paymentStatus === "paid");
    const pending = active.filter((g) => g.paymentStatus === "pending");
    const failed = active.filter((g) => g.paymentStatus === "failed");
    const refunded = active.filter((g) => g.paymentStatus === "refunded");
    const received = paid.reduce((s, g) => s + (g.amountPaid ?? 0), 0);
    const currency = paid.find((g) => g.currency)?.currency ?? "BRL";
    const overdue = eventPassed ? pending.length : 0;
    return { paid, pending, failed, refunded, received, currency, overdue };
  }, [active, eventPassed]);

  const currency = stats.currency;

  const pendingList = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = active.filter((g) =>
      ["pending", "failed"].includes(g.paymentStatus),
    );
    if (!q) return list;
    return list.filter(
      (g) =>
        g.name.toLowerCase().includes(q) ||
        (g.email ?? "").toLowerCase().includes(q) ||
        (g.phone ?? "").toLowerCase().includes(q),
    );
  }, [active, query]);

  async function markPaid(g: GuestRow) {
    setBusyId(g.id);
    const res = await fetch(`/api/events/${eventId}/guests/${g.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paymentStatus: "paid" }),
    });
    setBusyId(null);
    if (!res.ok) return toast.error("Erro ao marcar");
    toast.success(`${g.name} marcado como pago`);
    onChange();
  }

  return (
    <div className="space-y-6 pt-2">
      <Segmented
        value={view}
        onChange={setView}
        options={[
          { value: "overview", label: "Visão geral" },
          { value: "config", label: "Configuração de recebimento" },
        ]}
      />

      {view === "overview" ? (
        <>
          {/* Indicadores */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Metric
              icon={<DollarSign className="size-5" />}
              tone="bg-emerald-500/15 text-emerald-600"
              label="Total recebido"
              value={money(stats.received, currency)}
              hint={`${stats.paid.length} pagamento(s)`}
            />
            <Metric
              icon={<Clock className="size-5" />}
              tone="bg-amber-500/15 text-amber-600"
              label="Pendentes"
              value={stats.pending.length}
              hint="aguardando pagamento"
            />
            <Metric
              icon={<AlertTriangle className="size-5" />}
              tone="bg-orange-500/15 text-orange-600"
              label="Em atraso"
              value={stats.overdue}
              hint={eventPassed ? "evento já ocorreu" : "evento futuro"}
            />
            <Metric
              icon={<XCircle className="size-5" />}
              tone="bg-rose-500/15 text-rose-600"
              label="Recusados"
              value={stats.failed.length}
              hint={stats.refunded.length ? `${stats.refunded.length} reembolsado(s)` : undefined}
            />
          </div>

          {/* Lista de pendentes / recusados */}
          <Card>
            <CardContent className="p-0">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
                <div>
                  <p className="text-sm font-medium">Pagamentos a resolver</p>
                  <p className="text-xs text-muted-foreground">
                    Pendentes e recusados — marque como pago ou veja o status.
                  </p>
                </div>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Buscar pessoa"
                    className="h-9 w-56 pl-8 text-sm"
                  />
                </div>
              </div>

              {pendingList.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 py-14 text-center">
                  <Check className="size-7 text-emerald-500" />
                  <p className="text-sm font-medium">Nada pendente 🎉</p>
                  <p className="text-xs text-muted-foreground">
                    {query ? "Nada encontrado para a busca." : "Todos os pagamentos estão em dia."}
                  </p>
                </div>
              ) : (
                <ul className="divide-y">
                  {pendingList.map((g) => (
                    <li
                      key={g.id}
                      className="flex flex-wrap items-center gap-3 p-4 transition hover:bg-muted/40"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{g.name}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {g.email ?? g.phone ?? "sem contato"}
                        </span>
                      </span>
                      <Badge className={`border-transparent ${PAY_TONE[g.paymentStatus] ?? PAY_TONE.none}`}>
                        {PAY_LABEL[g.paymentStatus] ?? g.paymentStatus}
                      </Badge>
                      <Button
                        size="sm"
                        disabled={busyId === g.id}
                        onClick={() => markPaid(g)}
                      >
                        {busyId === g.id ? <Loader2 className="size-4 animate-spin" /> : <Check />}
                        Marcar como pago
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* Pagamentos confirmados */}
          {stats.paid.length > 0 && (
            <Card>
              <CardContent className="p-0">
                <div className="border-b p-4">
                  <p className="text-sm font-medium">Pagamentos confirmados</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                        <th className="px-4 py-2.5 font-medium">Pessoa</th>
                        <th className="px-4 py-2.5 font-medium">Valor</th>
                        <th className="px-4 py-2.5 font-medium">Pago em</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.paid.map((g) => (
                        <tr key={g.id} className="border-b transition last:border-0 hover:bg-muted/40">
                          <td className="px-4 py-2.5">
                            <span className="block font-medium">{g.name}</span>
                            {g.email && <span className="block text-xs text-muted-foreground">{g.email}</span>}
                          </td>
                          <td className="px-4 py-2.5 tabular-nums font-medium">
                            {g.amountPaid != null ? money(g.amountPaid, g.currency ?? currency) : "—"}
                          </td>
                          <td className="px-4 py-2.5 text-muted-foreground">
                            <Badge className="border-transparent bg-emerald-500/15 text-emerald-700">Pago</Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      ) : (
        <ConfigView
          cfg={cfg}
          saving={saving}
          sigKey={sigKey}
          setSigKey={setSigKey}
          patch={patch}
        />
      )}
    </div>
  );
}

const DEFAULT_REMINDER = `Olá, [NOME]!

Notamos que seu registro para o evento [nome do evento] foi iniciado, mas ainda não foi concluído, pois o pagamento da inscrição está pendente.

Para facilitar, segue abaixo o link para finalizar sua inscrição e garantir sua vaga:

[LINK DE PAGAMENTO]

As vagas são limitadas e a confirmação da participação acontece após a conclusão do pagamento.

Caso tenha qualquer dúvida ou encontre alguma dificuldade durante o processo, entre em contato conosco. Será um prazer ajudar.

Equipe OPTA Finance`;

function PricingReminderCard({
  cfg,
  saving,
  patch,
}: {
  cfg: Config;
  saving: boolean;
  patch: (body: Record<string, unknown>, msg?: string) => void;
}) {
  const [price, setPrice] = useState(
    cfg.priceCents != null ? (cfg.priceCents / 100).toString() : "",
  );
  const [minutes, setMinutes] = useState(String(cfg.paymentReminderMinutes ?? 30));
  const [msg, setMsg] = useState(cfg.paymentReminderMessage ?? "");

  return (
    <Card className="h-full lg:col-span-2">
      <CardContent className="space-y-5 p-5">
        <div className="flex items-center gap-2">
          <DollarSign className="size-4 text-muted-foreground" />
          <p className="font-medium">Cobrança & lembrete de pagamento</p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="price">Preço da inscrição ({cfg.currency})</Label>
            <div className="flex items-center gap-2">
              <Input
                id="price"
                type="number"
                min={0}
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="30.00"
              />
              <Button
                onClick={() =>
                  patch(
                    { priceCents: price === "" ? null : Math.round(Number(price) * 100) },
                    "Preço salvo",
                  )
                }
                disabled={saving}
              >
                Salvar
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Usado no link inteligente do Square e para conferir o valor pago.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="rem-min">Lembrete após (min)</Label>
            <div className="flex items-center gap-2">
              <Input
                id="rem-min"
                type="number"
                min={1}
                value={minutes}
                onChange={(e) => setMinutes(e.target.value)}
              />
              <Button
                onClick={() =>
                  patch({ paymentReminderMinutes: Number(minutes) || 30 }, "Salvo")
                }
                disabled={saving}
                variant="outline"
              >
                Salvar
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Envia o lembrete se o pagamento não constar após esse tempo.
            </p>
          </div>

          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-sm font-medium">Lembrete ligado</p>
              <p className="text-xs text-muted-foreground">WhatsApp (Stevo).</p>
            </div>
            <Button
              variant={cfg.paymentReminderEnabled ? "default" : "outline"}
              size="sm"
              onClick={() =>
                patch(
                  { paymentReminderEnabled: !cfg.paymentReminderEnabled },
                  cfg.paymentReminderEnabled ? "Desligado" : "Ligado",
                )
              }
            >
              {cfg.paymentReminderEnabled ? "Ligado" : "Desligado"}
            </Button>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="rem-msg">Mensagem do lembrete</Label>
          <Textarea
            id="rem-msg"
            rows={10}
            value={msg}
            onChange={(e) => setMsg(e.target.value)}
            placeholder={DEFAULT_REMINDER}
            className="font-mono text-xs"
          />
          <p className="text-xs text-muted-foreground">
            Variáveis: <code>[NOME]</code>, <code>[nome do evento]</code>,{" "}
            <code>[LINK DE PAGAMENTO]</code> (link inteligente do Square). Em branco
            usa o texto padrão.
          </p>
          <Button
            onClick={() => patch({ paymentReminderMessage: msg || null }, "Mensagem salva")}
            disabled={saving}
            size="sm"
          >
            Salvar mensagem
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ConfigView({
  cfg,
  saving,
  sigKey,
  setSigKey,
  patch,
}: {
  cfg: Config | null;
  saving: boolean;
  sigKey: string;
  setSigKey: (v: string) => void;
  patch: (body: Record<string, unknown>, msg?: string) => void;
}) {
  if (!cfg) return <p className="text-sm text-muted-foreground">Carregando…</p>;
  return (
    <div className="grid items-start gap-4 lg:grid-cols-2">
      <Card className="lg:col-span-2">
        <CardContent className="space-y-4 p-5">
          <div className="flex items-center gap-2">
            <Link2 className="size-4 text-muted-foreground" />
            <p className="font-medium">Webhooks de entrada</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <CopyField label="URL de inscrição (formulário)" value={cfg.registrationUrl} />
            <CopyField label="URL de pagamento (Square webhook)" value={cfg.squareUrl} />
          </div>
          {cfg.leadUrl && (
            <div className="space-y-1.5 rounded-lg border border-dashed bg-muted/30 p-3">
              <CopyField
                label="URL de leads do Spark (formulário → cria o convidado)"
                value={cfg.leadUrl}
              />
              <p className="text-xs text-muted-foreground">
                Configure esta URL numa ação <strong>Webhook</strong> do workflow do
                Spark que roda quando o formulário é enviado. O convidado é criado
                automaticamente no evento indicado pelo campo{" "}
                <strong>Agenda</strong>, com status{" "}
                <strong>Aguardando pagamento</strong>. É a mesma URL para todos os
                eventos.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="h-full">
        <CardContent className="space-y-4 p-5">
          <div className="flex items-center gap-2">
            <CreditCard className="size-4 text-muted-foreground" />
            <p className="font-medium">Square</p>
            <Badge variant={cfg.hasSignatureKey ? "default" : "secondary"}>
              {cfg.hasSignatureKey ? "Assinatura configurada" : "Sem assinatura"}
            </Badge>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sigkey">Webhook Signature Key</Label>
            <div className="flex items-center gap-2">
              <Input
                id="sigkey"
                type="password"
                value={sigKey}
                onChange={(e) => setSigKey(e.target.value)}
                placeholder={cfg.hasSignatureKey ? "•••••••• (defina para trocar)" : "cole a chave do Square"}
              />
              <Button
                onClick={() => {
                  patch({ squareSignatureKey: sigKey }, "Chave salva");
                  setSigKey("");
                }}
                disabled={saving || !sigKey.trim()}
              >
                {saving && <Loader2 className="size-4 animate-spin" />} Salvar
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <PricingReminderCard cfg={cfg} saving={saving} patch={patch} />

      <Card className="h-full">
        <CardContent className="space-y-4 p-5">
          <p className="font-medium">Automação</p>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium">Enviar QR ao confirmar pagamento</p>
              <p className="text-xs text-muted-foreground">Ingresso sai automaticamente ao pagar.</p>
            </div>
            <Button
              variant={cfg.autoSendQrOnPaid ? "default" : "outline"}
              size="sm"
              onClick={() => patch({ autoSendQrOnPaid: !cfg.autoSendQrOnPaid }, cfg.autoSendQrOnPaid ? "Desligado" : "Ligado")}
            >
              {cfg.autoSendQrOnPaid ? "Ligado" : "Desligado"}
            </Button>
          </div>
          <div className="space-y-1.5">
            <Label>Canal de envio do QR</Label>
            <Select value={cfg.sendChannel} onValueChange={(v) => patch({ sendChannel: v }, "Canal atualizado")}>
              <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ghl">Workflow do Spark (tag)</SelectItem>
                <SelectItem value="whatsapp">WhatsApp (Stevo)</SelectItem>
                <SelectItem value="email">E-mail (Resend)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between gap-3 border-t pt-3">
            <p className="text-sm">Integração ativa</p>
            <Button
              variant={cfg.active ? "default" : "outline"}
              size="sm"
              onClick={() => patch({ active: !cfg.active }, cfg.active ? "Pausada" : "Ativada")}
            >
              {cfg.active ? "Ativa" : "Pausada"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
