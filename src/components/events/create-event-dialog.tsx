"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarPlus,
  Loader2,
  Lock,
  MessagesSquare,
  Check,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { MessageScheduleContent } from "@/components/events/message-schedule-modal";

const PHASES = [
  { tone: "bg-sky-500/15 text-sky-600", label: "No cadastro" },
  { tone: "bg-emerald-500/15 text-emerald-600", label: "No pagamento" },
  { tone: "bg-amber-500/15 text-amber-600", label: "Antes do evento" },
  { tone: "bg-violet-500/15 text-violet-600", label: "Depois do evento" },
];

export function CreateEventDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    date: "",
    startTime: "",
    endTime: "",
    locationName: "",
    address: "",
    capacity: "",
  });

  function set(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function reset() {
    setCreatedId(null);
    setLoading(false);
    setForm({ name: "", date: "", startTime: "", endTime: "", locationName: "", address: "", capacity: "" });
  }

  async function createEvent(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const res = await fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error ?? "Erro ao criar evento");
      return;
    }
    const { event } = await res.json();
    setCreatedId(event.id);
    toast.success("Evento criado — agora configure as mensagens ao lado");
  }

  function finish() {
    const id = createdId;
    setOpen(false);
    if (id) router.push(`/events/${id}`);
    router.refresh();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) {
          if (createdId) router.refresh();
          reset();
        }
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <CalendarPlus /> Criar evento
        </Button>
      </DialogTrigger>
      <DialogContent className="w-[97vw] max-w-6xl gap-0 overflow-hidden p-0 sm:max-w-6xl">
        <DialogTitle className="sr-only">Novo evento</DialogTitle>
        <div className="flex h-[86vh] min-h-0 flex-col md:flex-row">
          {/* Coluna 1 — detalhes do evento */}
          <form
            onSubmit={createEvent}
            className="flex min-h-0 w-full flex-col border-b md:w-[40%] md:border-b-0 md:border-r"
          >
            <div className="flex items-center gap-3 border-b p-5">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <CalendarPlus className="size-5" />
              </span>
              <div>
                <p className="font-semibold leading-tight">Detalhes do evento</p>
                <p className="text-xs text-muted-foreground">Nome, data e local.</p>
              </div>
              {createdId && (
                <span className="ml-auto flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-medium text-emerald-700">
                  <Check className="size-3.5" /> Criado
                </span>
              )}
            </div>

            <fieldset
              disabled={!!createdId}
              className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5 disabled:opacity-70"
            >
              <div className="space-y-2">
                <Label htmlFor="name">Nome do evento *</Label>
                <Input
                  id="name"
                  value={form.name}
                  onChange={(e) => set("name", e.target.value)}
                  placeholder="Ex.: Vinhos, Mulheres e Riqueza"
                  required
                  autoFocus
                />
              </div>
              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Data & horário
                </p>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="date">Data *</Label>
                    <Input id="date" type="date" value={form.date} onChange={(e) => set("date", e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="startTime">Início</Label>
                    <Input id="startTime" type="time" value={form.startTime} onChange={(e) => set("startTime", e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="endTime">Fim</Label>
                    <Input id="endTime" type="time" value={form.endTime} onChange={(e) => set("endTime", e.target.value)} />
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="locationName">Local</Label>
                <Input
                  id="locationName"
                  value={form.locationName}
                  onChange={(e) => set("locationName", e.target.value)}
                  placeholder="Nome e endereço do espaço"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="capacity">Capacidade</Label>
                <Input
                  id="capacity"
                  type="number"
                  min={1}
                  value={form.capacity}
                  onChange={(e) => set("capacity", e.target.value)}
                  placeholder="Sem limite"
                />
              </div>
            </fieldset>

            <div className="border-t p-4">
              {!createdId ? (
                <Button type="submit" className="w-full" disabled={loading || !form.name || !form.date}>
                  {loading && <Loader2 className="size-4 animate-spin" />}
                  Criar evento e liberar mensagens
                </Button>
              ) : (
                <p className="text-center text-xs text-muted-foreground">
                  Detalhes salvos. Ajustes finos depois em Configurações.
                </p>
              )}
            </div>
          </form>

          {/* Coluna 2 — mensagens (acoplada) */}
          <div className="relative flex min-h-0 flex-1 flex-col">
            {createdId ? (
              <MessageScheduleContent
                eventId={createdId}
                eventName={form.name}
                heightClass="h-full"
              />
            ) : (
              <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 bg-muted/20 p-8 text-center">
                <span className="flex size-14 items-center justify-center rounded-2xl bg-background shadow-sm ring-1 ring-border">
                  <MessagesSquare className="size-6 text-primary" />
                </span>
                <div className="max-w-xs">
                  <p className="flex items-center justify-center gap-1.5 font-semibold">
                    <Lock className="size-4" /> Mensagens do evento
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Configure a jornada completa — do cadastro ao pós-evento — junto
                    com a criação. Preencha os detalhes ao lado e clique em criar.
                  </p>
                </div>
                <div className="grid w-full max-w-xs grid-cols-2 gap-2">
                  {PHASES.map((p) => (
                    <div
                      key={p.label}
                      className="flex items-center gap-2 rounded-lg border bg-background/60 px-3 py-2 text-left text-xs"
                    >
                      <span className={`size-2 rounded-full ${p.tone}`} />
                      {p.label}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {createdId && (
              <div className="border-t bg-card/90 p-3 backdrop-blur">
                <div className="mx-auto flex max-w-2xl items-center justify-between gap-3">
                  <p className="text-xs text-muted-foreground">
                    As mensagens salvam automaticamente.
                  </p>
                  <Button onClick={finish}>
                    Concluir e abrir evento <ArrowRight className="size-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
