"use client";

import { useEffect, useRef, useState } from "react";
import { FileCog, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import type { TicketConfig } from "@/lib/ticket-template";

const TOGGLES: { key: keyof TicketConfig; label: string }[] = [
  { key: "showTime", label: "Mostrar horário" },
  { key: "showLocation", label: "Mostrar local" },
  { key: "showEmail", label: "Mostrar e-mail do convidado" },
  { key: "showPhone", label: "Mostrar telefone do convidado" },
];

export function TicketTemplateEditor({
  eventId,
}: {
  eventId: string;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<TicketConfig | null>(null);
  const [scope, setScope] = useState<"org" | "event">("org");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const urlRef = useRef<string | null>(null);

  // Carrega o modelo atual ao abrir.
  useEffect(() => {
    if (!open || config) return;
    setLoading(true);
    fetch(`/api/events/${eventId}/ticket-template`)
      .then((r) => r.json())
      .then((d) => {
        setConfig(d.config);
        setScope(d.scope === "event" ? "event" : "org");
      })
      .catch(() => toast.error("Erro ao carregar o modelo"))
      .finally(() => setLoading(false));
  }, [open, config, eventId]);

  // Prévia ao vivo (debounce) sempre que o config muda.
  useEffect(() => {
    if (!open || !config) return;
    setPreviewing(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch("/api/ticket/preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ config }),
        });
        const blob = await res.blob();
        if (urlRef.current) URL.revokeObjectURL(urlRef.current);
        const url = URL.createObjectURL(blob);
        urlRef.current = url;
        setPreviewUrl(url);
      } catch {
        /* ignora */
      } finally {
        setPreviewing(false);
      }
    }, 500);
    return () => clearTimeout(t);
  }, [config, open]);

  useEffect(() => {
    return () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    };
  }, []);

  function set<K extends keyof TicketConfig>(key: K, value: TicketConfig[K]) {
    setConfig((c) => (c ? { ...c, [key]: value } : c));
  }

  async function save() {
    if (!config) return;
    setSaving(true);
    const res = await fetch(`/api/events/${eventId}/ticket-template`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ config, scope }),
    });
    setSaving(false);
    if (!res.ok) {
      toast.error("Erro ao salvar o modelo");
      return;
    }
    toast.success(
      scope === "org"
        ? "Modelo salvo como padrão da organização"
        : "Modelo salvo para este evento",
    );
    setOpen(false);
  }

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <Button variant="outline">
          <FileCog className="size-4" /> Modelo do ingresso
        </Button>
      </DrawerTrigger>
      <DrawerContent className="sm:max-w-3xl">
        <DrawerHeader>
          <DrawerTitle>Modelo do ingresso (PDF)</DrawerTitle>
          <DrawerDescription>
            Personalize o design. A prévia usa dados de exemplo do evento e do
            convidado.
          </DrawerDescription>
        </DrawerHeader>

        <DrawerBody className="grid gap-6 lg:grid-cols-2">
          {loading || !config ? (
            <div className="col-span-full flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="mr-2 size-4 animate-spin" /> Carregando…
            </div>
          ) : (
            <>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Estilo</Label>
                  <Select
                    value={config.preset}
                    onValueChange={(v) =>
                      set("preset", v as TicketConfig["preset"])
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="modern">Moderno</SelectItem>
                      <SelectItem value="classic">Clássico</SelectItem>
                      <SelectItem value="compact">Compacto</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Efeito do cabeçalho</Label>
                    <Select
                      value={config.headerEffect}
                      onValueChange={(v) =>
                        set("headerEffect", v as TicketConfig["headerEffect"])
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Nenhum</SelectItem>
                        <SelectItem value="halftone">Halftone (pontos)</SelectItem>
                        <SelectItem value="bars">Barras diagonais</SelectItem>
                        <SelectItem value="gradient">Gradiente</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Fundo</Label>
                    <Select
                      value={config.background}
                      onValueChange={(v) =>
                        set("background", v as TicketConfig["background"])
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="plain">Liso</SelectItem>
                        <SelectItem value="dots">Pontilhado</SelectItem>
                        <SelectItem value="grid">Grade</SelectItem>
                        <SelectItem value="gradient">Gradiente suave</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label>Cor principal</Label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={config.brandColor}
                      onChange={(e) => set("brandColor", e.target.value)}
                      className="h-8 w-12 cursor-pointer rounded border bg-transparent"
                      aria-label="Cor principal"
                    />
                    <Input
                      value={config.brandColor}
                      onChange={(e) => set("brandColor", e.target.value)}
                      className="w-32"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label>Logo (URL)</Label>
                  <Input
                    placeholder="https://…/logo.png (opcional)"
                    value={config.logoUrl ?? ""}
                    onChange={(e) => set("logoUrl", e.target.value || null)}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Título do cabeçalho</Label>
                  <Input
                    placeholder="Vazio = nome do evento"
                    value={config.headerTitle}
                    onChange={(e) => set("headerTitle", e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Subtítulo</Label>
                  <Input
                    placeholder="Vazio = data · local"
                    value={config.subtitle}
                    onChange={(e) => set("subtitle", e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Instruções (rodapé)</Label>
                  <Textarea
                    rows={2}
                    value={config.instructions}
                    onChange={(e) => set("instructions", e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Campos: {"{{event.name}}"}, {"{{event.date}}"},{" "}
                    {"{{contact.name}}"}…
                  </p>
                </div>

                <div className="space-y-2">
                  {TOGGLES.map((t) => (
                    <label
                      key={t.key}
                      className="flex cursor-pointer items-center gap-2 text-sm"
                    >
                      <input
                        type="checkbox"
                        className="size-4 accent-primary"
                        checked={Boolean(config[t.key])}
                        onChange={(e) => set(t.key, e.target.checked as never)}
                      />
                      {t.label}
                    </label>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Prévia</Label>
                  {previewing && (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Loader2 className="size-3 animate-spin" /> atualizando
                    </span>
                  )}
                </div>
                <div className="h-[460px] overflow-hidden rounded-lg border bg-muted">
                  {previewUrl ? (
                    <iframe
                      src={previewUrl}
                      title="Prévia do ingresso"
                      className="h-full w-full"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                      Gerando prévia…
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </DrawerBody>

        <DrawerFooter className="sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground">Salvar como</Label>
            <Select value={scope} onValueChange={(v) => setScope(v as "org" | "event")}>
              <SelectTrigger className="w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="org">Padrão da organização</SelectItem>
                <SelectItem value="event">Somente este evento</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={save} disabled={saving || !config}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            Salvar modelo
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
