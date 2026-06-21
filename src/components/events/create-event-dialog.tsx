"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarPlus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export function CreateEventDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
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

  async function handleSubmit(e: React.FormEvent) {
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
    setOpen(false);
    toast.success("Evento criado");
    router.push(`/events/${event.id}`);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <CalendarPlus /> Criar evento
        </Button>
      </DialogTrigger>
      <DialogContent className="gap-0 p-0 sm:max-w-lg">
        <DialogHeader className="flex-row items-center gap-3 border-b p-5">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <CalendarPlus className="size-5" />
          </span>
          <div className="space-y-0.5">
            <DialogTitle className="text-base">Novo evento</DialogTitle>
            <DialogDescription>
              Defina o básico agora — você ajusta tudo depois nas configurações.
            </DialogDescription>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col">
          <div className="space-y-5 p-5">
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
                  <Input
                    id="date"
                    type="date"
                    value={form.date}
                    onChange={(e) => set("date", e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="startTime">Início</Label>
                  <Input
                    id="startTime"
                    type="time"
                    value={form.startTime}
                    onChange={(e) => set("startTime", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="endTime">Fim</Label>
                  <Input
                    id="endTime"
                    type="time"
                    value={form.endTime}
                    onChange={(e) => set("endTime", e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Local & capacidade
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="locationName">Local</Label>
                  <Input
                    id="locationName"
                    value={form.locationName}
                    onChange={(e) => set("locationName", e.target.value)}
                    placeholder="Nome do espaço"
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
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="address">Endereço</Label>
                  <Input
                    id="address"
                    value={form.address}
                    onChange={(e) => set("address", e.target.value)}
                    placeholder="Rua, número, cidade"
                  />
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="mx-0 mb-0">
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancelar
              </Button>
            </DialogClose>
            <Button type="submit" disabled={loading || !form.name || !form.date}>
              {loading && <Loader2 className="size-4 animate-spin" />}
              Criar evento
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
