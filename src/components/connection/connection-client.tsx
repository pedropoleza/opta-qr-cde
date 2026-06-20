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
}: {
  initialStatus: GhlConnectionStatus;
}) {
  const [status, setStatus] = useState<GhlConnectionStatus>(initialStatus);
  const [testing, setTesting] = useState(false);

  const meta = STATE_META[status.state];
  const StatusIcon = meta.icon;
  const locationName =
    status.state === "connected" ? status.location.name : undefined;

  async function testConnection() {
    setTesting(true);
    try {
      const res = await fetch("/api/ghl/connection", { cache: "no-store" });
      const data = (await res.json()) as GhlConnectionStatus;
      setStatus(data);
      if (data.state === "connected") toast.success("Spark conectado");
      else if (data.state === "error") toast.error("Falha na verificação da conexão");
      else toast.warning("Spark não está configurado");
    } catch {
      toast.error("Não foi possível testar a conexão");
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader
        title="Conexão do Spark"
        description="Integração com o HighLevel usada para sincronizar contatos, tags e o envio do convite."
        actions={
          <HelpModal
            title="Sobre a conexão"
            description="Como o Spark fala com o seu CRM."
          >
            <p>
              Na versão atual a conexão usa um{" "}
              <strong className="text-foreground">Private Integration Token</strong>{" "}
              da location, configurado nas variáveis de ambiente do servidor.
            </p>
            <p>
              O <strong className="text-foreground">desconectar</strong> com um
              clique chega junto com o login OAuth do Spark (Etapa 4), quando a
              credencial passa a ser guardada criptografada por organização.
            </p>
          </HelpModal>
        }
      />

      <Card>
        <CardContent className="space-y-5 p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-lg bg-muted text-foreground">
                <PlugZap className="size-5" />
              </span>
              <div>
                <p className="font-medium">Spark · HighLevel</p>
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
          {status.state === "disconnected" && (
            <p className="rounded-md bg-muted p-3 text-xs text-muted-foreground">
              Defina <code>GHL_LOCATION_ID</code> e{" "}
              <code>GHL_LOCATION_TOKEN</code> nas variáveis de ambiente para
              conectar o Spark.
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
                    <p className="font-medium text-foreground">
                      Private Integration Token
                    </p>
                    <p className="mt-1 text-muted-foreground">
                      Uma chave da location do HighLevel que autoriza o Spark a
                      aplicar tags, notas e campos nos contatos. Fica nas
                      variáveis de ambiente do servidor — nunca aparece aqui.
                    </p>
                  </PopoverContent>
                </Popover>
              </dt>
              <dd className="mt-1 text-sm">
                {status.state === "disconnected"
                  ? "Não configurada"
                  : "Private Integration Token"}
              </dd>
            </div>
          </dl>

          <div className="flex flex-wrap items-center gap-2 border-t pt-4">
            <Button variant="outline" onClick={testConnection} disabled={testing}>
              {testing ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <RefreshCw className="size-4" />
              )}
              Testar conexão
            </Button>
            <Button variant="destructive" disabled title="Disponível com o OAuth (Etapa 4)">
              <Unplug className="size-4" />
              Desconectar
            </Button>
            <span className="text-xs text-muted-foreground">
              Desconectar fica disponível com o login OAuth do Spark.
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
