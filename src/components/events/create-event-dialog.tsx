"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarPlus, Loader2, MessagesSquare } from "lucide-react";
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
import {
  CreationMessages,
  emptyDraft,
  saveMessageDraft,
  type MsgDraft,
} from "@/components/events/creation-messages";

export function CreateEventDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    date: "",
    startTime: "",
    endTime: "",
    locationName: "",
    capacity: "",
  });
  const [draft, setDraft] = useState<MsgDraft>(emptyDraft);

  function set(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }
  function reset() {
    setForm({ name: "", date: "", startTime: "", endTime: "", locationName: "", capacity: "" });
    setDraft(emptyDraft);
    setSaving(false);
  }

  async function create() {
    if (!form.name || !form.date) return;
    setSaving(true);
    const res = await fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (!res.ok) {
      setSaving(false);
      const d = await res.json().catch(() => ({}));
      toast.error(d.error ?? "Erro ao criar evento");
      return;
    }
    const { event } = await res.json();
    await saveMessageDraft(event.id, draft); // rascunho local → salvo agora
    toast.success("Evento criado");
    setOpen(false);
    reset();
    router.push(`/events/${event.id}`);
    router.refresh();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <CalendarPlus /> Criar evento
        </Button>
      </DialogTrigger>
      <DialogContent className="w-[97vw] max-w-6xl gap-0 overflow-hidden p-0 sm:max-w-6xl">
        <DialogTitle className="sr-only">Novo evento</DialogTitle>
        <div className="flex h-[88vh] min-h-0 flex-col md:flex-row">
          {/* Detalhes */}
          <div className="flex min-h-0 w-full flex-col border-b md:w-[38%] md:border-b-0 md:border-r">
            <div className="flex items-center gap-3 p-5">
              <span className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <CalendarPlus className="size-5" />
              </span>
              <p className="text-lg font-semibold">Novo evento</p>
            </div>
            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 pb-5">
              <div className="space-y-2">
                <Label htmlFor="name">Nome *</Label>
                <Input id="name" value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Ex.: Vinhos, Mulheres e Riqueza" required autoFocus />
              </div>
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
              <div className="space-y-2">
                <Label htmlFor="locationName">Local</Label>
                <Input id="locationName" value={form.locationName} onChange={(e) => set("locationName", e.target.value)} placeholder="Nome e endereço do espaço" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="capacity">Capacidade</Label>
                <Input id="capacity" type="number" min={1} value={form.capacity} onChange={(e) => set("capacity", e.target.value)} placeholder="Sem limite" />
              </div>
            </div>
          </div>

          {/* Mensagens (rascunho, sem precisar criar o evento) */}
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex items-center gap-2 px-5 pt-5">
              <MessagesSquare className="size-5 text-primary" />
              <p className="text-lg font-semibold">Mensagens</p>
              <span className="text-xs text-muted-foreground">configure agora — salva ao criar</span>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-5">
              <CreationMessages value={draft} onChange={setDraft} />
            </div>
            <div className="border-t bg-card/90 p-4 backdrop-blur">
              <Button className="w-full" size="lg" onClick={create} disabled={saving || !form.name || !form.date}>
                {saving && <Loader2 className="size-4 animate-spin" />}
                Criar evento
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
