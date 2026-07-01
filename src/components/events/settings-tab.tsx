"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Star, Trash2, AlertTriangle } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import type { EventData } from "@/components/events/event-detail";
import { EVENT_STATUS_LABEL } from "@/components/events/status";

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="h-full transition hover:shadow-sm">
      <CardContent className="flex h-full flex-col gap-4 p-5">
        <div>
          <p className="font-medium">{title}</p>
          {description && (
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          )}
        </div>
        <div className="space-y-4">{children}</div>
      </CardContent>
    </Card>
  );
}

export function SettingsTab({
  event,
  onChange,
}: {
  event: EventData;
  onChange: () => void;
}) {
  const [form, setForm] = useState({
    name: event.name,
    date: event.date,
    startTime: event.startTime ?? "",
    endTime: event.endTime ?? "",
    locationName: event.locationName ?? "",
    address: event.address ?? "",
    capacity: event.capacity?.toString() ?? "",
    status: event.status,
    vipNotifyChannel: event.vipNotifyChannel ?? "none",
    vipNotifyTarget: event.vipNotifyTarget ?? "",
    ghlTag: event.ghlTag ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const router = useRouter();

  function set(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function deleteEvent() {
    setDeleting(true);
    const res = await fetch(`/api/events/${event.id}`, { method: "DELETE" });
    if (!res.ok) {
      setDeleting(false);
      const d = await res.json().catch(() => ({}));
      toast.error(d.error ?? "Erro ao excluir o evento");
      return;
    }
    toast.success("Evento excluído");
    router.push("/events");
    router.refresh();
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (
      form.status === "completed" &&
      event.status !== "completed" &&
      !confirm(
        "Encerrar o evento marca todos os convidados sem check-in como ausentes (no-show). Continuar?",
      )
    ) {
      return;
    }
    setSaving(true);
    const payload = {
      ...form,
      vipNotifyChannel: form.vipNotifyChannel === "none" ? "" : form.vipNotifyChannel,
    };
    const res = await fetch(`/api/events/${event.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSaving(false);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(data.error ?? "Erro ao salvar");
      return;
    }
    toast.success("Evento atualizado");
    onChange();
  }

  return (
    <form onSubmit={save} className="mx-auto max-w-6xl space-y-4 pb-24 pt-2">
      <div className="rounded-xl border bg-muted/20 p-4">
        <p className="text-sm font-medium">Configurações do evento</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Blocos organizados: detalhes, data & local, capacidade, público (tag) e
          avisos VIP. Design do QR, mensagens e recebimento ficam nas abas Envios,
          Mensagens e Pagamentos.
        </p>
      </div>
      <div className="grid items-start gap-4 lg:grid-cols-2">
      <Section title="Detalhes" description="Nome do evento exibido aos convidados.">
        <div className="space-y-2">
          <Label htmlFor="s-name">Nome</Label>
          <Input
            id="s-name"
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            required
          />
        </div>
      </Section>

      <Section
        title="Data, horário e local"
        description="Quando e onde o evento acontece."
      >
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-2">
            <Label htmlFor="s-date">Data</Label>
            <Input
              id="s-date"
              type="date"
              value={form.date}
              onChange={(e) => set("date", e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="s-start">Início</Label>
            <Input
              id="s-start"
              type="time"
              value={form.startTime}
              onChange={(e) => set("startTime", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="s-end">Fim</Label>
            <Input
              id="s-end"
              type="time"
              value={form.endTime}
              onChange={(e) => set("endTime", e.target.value)}
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="s-location">Local</Label>
          <Input
            id="s-location"
            value={form.locationName}
            onChange={(e) => set("locationName", e.target.value)}
            placeholder="Nome e endereço do espaço"
          />
        </div>
      </Section>

      <Section
        title="Capacidade & status"
        description="Defina o teto de público e o estágio do evento (rascunho, ativo…)."
      >
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="s-capacity">Capacidade</Label>
            <Input
              id="s-capacity"
              type="number"
              min={1}
              value={form.capacity}
              onChange={(e) => set("capacity", e.target.value)}
              placeholder="Sem limite"
            />
          </div>
          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={form.status} onValueChange={(v) => set("status", v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(EVENT_STATUS_LABEL).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Identificador nas automações Spark: <code>{event.slug}</code>{" "}
          (convidado-{event.slug}, presente-evento-{event.slug}, faltou-{event.slug})
        </p>
      </Section>

      <Section
        title="Público no Spark (tag)"
        description="Tag exata que identifica os contatos deste evento no Spark. Usada para filtrar e importar contatos por tag."
      >
        <div className="space-y-2">
          <Label htmlFor="s-ghltag">Tag do evento</Label>
          <Input
            id="s-ghltag"
            value={form.ghlTag}
            onChange={(e) => set("ghlTag", e.target.value)}
            placeholder={`ex.: convidado-${event.slug}`}
          />
          <p className="text-xs text-muted-foreground">
            Deixe em branco para não usar uma tag fixa.
          </p>
        </div>
      </Section>

      <Section
        title="Aviso de VIP"
        description="Quando um convidado VIP faz check-in, o anfitrião é avisado na hora."
      >
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">
              <Star className="size-3.5 text-amber-500" /> Canal
            </Label>
            <Select
              value={form.vipNotifyChannel}
              onValueChange={(v) => set("vipNotifyChannel", v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Desativado</SelectItem>
                <SelectItem value="whatsapp">WhatsApp</SelectItem>
                <SelectItem value="email">E-mail</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="s-viptarget">
              {form.vipNotifyChannel === "email" ? "E-mail do anfitrião" : "WhatsApp do anfitrião"}
            </Label>
            <Input
              id="s-viptarget"
              value={form.vipNotifyTarget}
              onChange={(e) => set("vipNotifyTarget", e.target.value)}
              placeholder={form.vipNotifyChannel === "email" ? "anfitriao@empresa.com" : "5538999999999"}
              disabled={form.vipNotifyChannel === "none"}
            />
          </div>
        </div>
      </Section>
      </div>

      {/* Zona de perigo */}
      <Card className="border-destructive/30">
        <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
              <AlertTriangle className="size-5" />
            </span>
            <div>
              <p className="font-medium">Excluir evento</p>
              <p className="text-sm text-muted-foreground">
                Remove o evento e <strong>todos os dados</strong> (convidados,
                ingressos, check-ins, mensagens, pagamentos). Ação irreversível.
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="destructive"
            className="shrink-0"
            onClick={() => setConfirmDelete(true)}
          >
            <Trash2 /> Excluir evento
          </Button>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Excluir este evento?"
        description={
          <>
            <strong>{event.name}</strong> e todos os dados relacionados serão
            apagados permanentemente. Isso não pode ser desfeito.
          </>
        }
        confirmLabel="Excluir definitivamente"
        destructive
        loading={deleting}
        onConfirm={deleteEvent}
      />

      {/* Barra de ação fixa */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t bg-card/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-end gap-3 px-4 py-3">
          <p className="mr-auto text-sm text-muted-foreground">
            Alterações são aplicadas ao salvar.
          </p>
          <Button type="submit" disabled={saving}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            Salvar alterações
          </Button>
        </div>
      </div>
    </form>
  );
}
