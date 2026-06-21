"use client";

import { useEffect, useState } from "react";
import { Check, Copy, CreditCard, Link2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Config = {
  registrationUrl: string;
  squareUrl: string;
  hasSignatureKey: boolean;
  autoSendQrOnPaid: boolean;
  sendChannel: string;
  active: boolean;
};

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

export function PaymentsTab({ eventId }: { eventId: string }) {
  const [cfg, setCfg] = useState<Config | null>(null);
  const [sigKey, setSigKey] = useState("");
  const [saving, setSaving] = useState(false);

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
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      toast.error(d.error ?? "Erro ao salvar");
      return;
    }
    if (msg) toast.success(msg);
    load();
  }

  if (!cfg) return <p className="text-sm text-muted-foreground">Carregando…</p>;

  return (
    <div className="max-w-2xl space-y-5 pt-2">
      <Card>
        <CardContent className="space-y-4 p-5">
          <div className="flex items-center gap-2">
            <Link2 className="size-4 text-muted-foreground" />
            <p className="font-medium">Webhooks de entrada</p>
          </div>
          <p className="text-sm text-muted-foreground">
            Aponte seu formulário para a URL de inscrição e configure a URL de
            pagamento como webhook no Square. O app cria o convidado na inscrição
            e dispara o QR quando o pagamento é confirmado.
          </p>
          <CopyField label="URL de inscrição (formulário)" value={cfg.registrationUrl} />
          <CopyField label="URL de pagamento (Square webhook)" value={cfg.squareUrl} />
        </CardContent>
      </Card>

      <Card>
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
            <p className="text-xs text-muted-foreground">
              No painel do Square (Developer → Webhooks), use a URL de pagamento
              acima e assine os eventos de pagamento. A chave valida cada webhook.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 p-5">
          <p className="font-medium">Automação</p>

          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium">Enviar QR ao confirmar pagamento</p>
              <p className="text-xs text-muted-foreground">
                Assim que o Square confirmar, o ingresso sai automaticamente.
              </p>
            </div>
            <Button
              variant={cfg.autoSendQrOnPaid ? "default" : "outline"}
              size="sm"
              onClick={() =>
                patch(
                  { autoSendQrOnPaid: !cfg.autoSendQrOnPaid },
                  cfg.autoSendQrOnPaid ? "Desligado" : "Ligado",
                )
              }
            >
              {cfg.autoSendQrOnPaid ? "Ligado" : "Desligado"}
            </Button>
          </div>

          <div className="space-y-1.5">
            <Label>Canal de envio do QR</Label>
            <Select
              value={cfg.sendChannel}
              onValueChange={(v) => patch({ sendChannel: v }, "Canal atualizado")}
            >
              <SelectTrigger className="w-56">
                <SelectValue />
              </SelectTrigger>
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
              onClick={() =>
                patch({ active: !cfg.active }, cfg.active ? "Pausada" : "Ativada")
              }
            >
              {cfg.active ? "Ativa" : "Pausada"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
