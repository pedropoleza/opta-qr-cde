"use client";

import { useState } from "react";
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  CircleHelp,
  KeyRound,
  Loader2,
  PlugZap,
  RefreshCw,
  Unplug,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { HelpModal } from "@/components/ui/help-modal";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { GhlConnectionStatus } from "@/lib/ghl";

const STATE_META: Record<
  GhlConnectionStatus["state"],
  { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: typeof PlugZap }
> = {
  connected: { label: "Conectado", variant: "default", icon: CheckCircle2 },
  error: { label: "Verificação falhou", variant: "destructive", icon: AlertTriangle },
  disconnected: { label: "Não conectado", variant: "secondary", icon: Unplug },
};

export function ConnectionClient({
  initialStatus,
  oauthAvailable = false,
}: {
  initialStatus: GhlConnectionStatus;
  oauthAvailable?: boolean;
}) {
  const [status, setStatus] = useState<GhlConnectionStatus>(initialStatus);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [settingUp, setSettingUp] = useState(false);
  const [form, setForm] = useState({
    locationId: initialStatus.locationId ?? "",
    token: "",
  });

  const meta = STATE_META[status.state];
  const StatusIcon = meta.icon;
  const locationName =
    status.state === "connected" ? status.location.name : undefined;

  async function testConnection() {
    setTesting(true);
    try {
      const res = await fetch("/api/ghl/connection", { cache: "no-store" });
      setStatus((await res.json()) as GhlConnectionStatus);
    } catch {
      toast.error("Não foi possível testar a conexão");
    } finally {
      setTesting(false);
    }
  }

  async function connect(e: React.FormEvent) {
    e.preventDefault();
    if (!form.locationId.trim() || !form.token.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/ghl/connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = (await res.json()) as GhlConnectionStatus & { error?: string };
      if (!res.ok) {
        toast.error(data.error ?? "Erro ao salvar a conexão");
        return;
      }
      setStatus(data);
      setForm((f) => ({ ...f, token: "" }));
      if (data.state === "connected") toast.success("Spark conectado");
      else toast.warning("Salvo, mas a verificação falhou — confira o token.");
    } finally {
      setSaving(false);
    }
  }

  async function disconnect() {
    setDisconnecting(true);
    try {
      await fetch("/api/ghl/connection", { method: "DELETE" });
      setStatus({ state: "disconnected", locationId: null });
      toast.success("Spark desconectado");
    } finally {
      setDisconnecting(false);
    }
  }

  async function setupFields() {
    setSettingUp(true);
    try {
      const res = await fetch("/api/ghl/setup-fields", { method: "POST" });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(d.error ?? "Erro ao preparar os campos");
        return;
      }
      const created = d.created?.length ?? 0;
      toast.success(
        created > 0
          ? `${created} campo(s) criado(s) no Spark. Pronto para o workflow.`
          : "Campos já estavam prontos no Spark.",
      );
      if (d.failed?.length) {
        toast.warning(`Não consegui criar: ${d.failed.join(", ")} (crie manualmente).`);
      }
    } finally {
      setSettingUp(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader
        title="Conexão do Spark"
        description="Integração com o seu CRM Spark — sincroniza contatos, tags e o envio do convite."
        actions={
          <HelpModal title="Sobre a conexão" description="Como o Spark fala com o seu CRM.">
            <p>
              Cada organização conecta o <strong className="text-foreground">próprio</strong>{" "}
              CRM Spark com um <strong className="text-foreground">Private Integration Token</strong>{" "}
              da location. O token é guardado <strong className="text-foreground">criptografado</strong>.
            </p>
            <p>
              No Spark: Settings → Private Integrations → criar token com os escopos
              de contatos/tags. Cole aqui junto com o Location ID.
            </p>
          </HelpModal>
        }
      />

      {oauthAvailable && (
        <Card>
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-5">
            <div className="flex items-center gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <PlugZap className="size-5" />
              </span>
              <div>
                <p className="font-medium">Conectar em 1 clique</p>
                <p className="text-sm text-muted-foreground">
                  Autorize o Spark na sua conta e o envio de e-mail/WhatsApp passa
                  a sair direto — sem token manual.
                </p>
              </div>
            </div>
            <Button asChild>
              <a href="/api/ghl/oauth/start">
                <PlugZap className="size-4" /> Conectar com o Spark
              </a>
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="space-y-5 p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-lg bg-muted text-foreground">
                <PlugZap className="size-5" />
              </span>
              <div>
                <p className="font-medium">Spark CRM</p>
                <p className="text-sm text-muted-foreground">
                  {locationName ?? "Location do credenciamento"}
                </p>
              </div>
            </div>
            <Badge variant={meta.variant} className="gap-1">
              <StatusIcon className="size-3.5" />
              {meta.label}
            </Badge>
          </div>

          {status.state === "error" && (
            <p className="rounded-md bg-destructive/10 p-3 text-xs text-destructive">
              {status.message}
            </p>
          )}

          <dl className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border p-3">
              <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Building2 className="size-3.5" /> Location ID
              </dt>
              <dd className="mt-1 truncate font-mono text-sm">
                {status.locationId ?? "—"}
              </dd>
            </div>
            <div className="rounded-lg border p-3">
              <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <KeyRound className="size-3.5" /> Credencial
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      aria-label="O que é a credencial?"
                      className="ml-0.5 text-muted-foreground transition-colors hover:text-foreground"
                    >
                      <CircleHelp className="size-3.5" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent align="start">
                    <p className="font-medium text-foreground">Private Integration Token</p>
                    <p className="mt-1 text-muted-foreground">
                      Chave da location do Spark que autoriza o credenciamento a
                      aplicar tags, notas e campos nos contatos. Guardada criptografada.
                    </p>
                  </PopoverContent>
                </Popover>
              </dt>
              <dd className="mt-1 text-sm">
                {status.state === "disconnected" ? "Não configurada" : "Private Integration Token"}
              </dd>
            </div>
          </dl>

          <div className="flex flex-wrap items-center gap-2 border-t pt-4">
            <Button variant="outline" onClick={testConnection} disabled={testing}>
              {testing ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
              Testar conexão
            </Button>
            <Button
              variant="outline"
              onClick={setupFields}
              disabled={settingUp || status.state !== "connected"}
            >
              {settingUp ? <Loader2 className="size-4 animate-spin" /> : <KeyRound className="size-4" />}
              Preparar campos no Spark
            </Button>
            <Button
              variant="destructive"
              onClick={disconnect}
              disabled={disconnecting || status.state === "disconnected"}
            >
              {disconnecting ? <Loader2 className="size-4 animate-spin" /> : <Unplug className="size-4" />}
              Desconectar
            </Button>
          </div>
          {status.state === "connected" && (
            <p className="text-xs text-muted-foreground">
              "Preparar campos" cria automaticamente no Spark os campos usados no
              e-mail do workflow (nome, evento, data, QR, PDF…).
            </p>
          )}
        </CardContent>
      </Card>

      {/* Conectar / atualizar credencial */}
      <Card>
        <CardContent className="p-5">
          <p className="mb-1 font-medium">
            {status.state === "connected" ? "Atualizar credencial" : "Conectar o Spark"}
          </p>
          <p className="mb-4 text-sm text-muted-foreground">
            Cole o Location ID e o Private Integration Token desta organização.
          </p>
          <form onSubmit={connect} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="loc">Location ID</Label>
              <Input
                id="loc"
                value={form.locationId}
                onChange={(e) => setForm((f) => ({ ...f, locationId: e.target.value }))}
                placeholder="ex.: qz19EgcgJfyjdVg8krSz"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tok">Private Integration Token</Label>
              <Input
                id="tok"
                type="password"
                value={form.token}
                onChange={(e) => setForm((f) => ({ ...f, token: e.target.value }))}
                placeholder="pit-..."
                required
              />
            </div>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="size-4 animate-spin" />}
              {status.state === "connected" ? "Atualizar e testar" : "Conectar e testar"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
