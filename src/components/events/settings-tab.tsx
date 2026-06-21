"use client";

import { useState } from "react";
import { Loader2, Star } from "lucide-react";
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
    <Card>
      <CardContent className="grid gap-5 p-5 md:grid-cols-[220px_1fr]">
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
  });
  const [saving, setSaving] = useState(false);

  function set(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
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
    <form onSubmit={save} className="max-w-3xl space-y-5 pb-20 pt-2">
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
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="s-location">Local</Label>
            <Input
              id="s-location"
              value={form.locationName}
              onChange={(e) => set("locationName", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="s-address">Endereço</Label>
            <Input
              id="s-address"
              value={form.address}
              onChange={(e) => set("address", e.target.value)}
            />
          </div>
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

      {/* Barra de ação fixa */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t bg-card/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-end gap-3 px-4 py-3">
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
