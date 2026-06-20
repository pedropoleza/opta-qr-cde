"use client";

import { useState } from "react";
import { Clock, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import type { SessionInfo } from "@/components/events/event-detail";

// #8 Gestão de sessões/horários com capacidade e ocupação ao vivo.
export function SessionsTab({
  eventId,
  sessions,
  onChange,
}: {
  eventId: string;
  sessions: SessionInfo[];
  onChange: () => void;
}) {
  const [form, setForm] = useState({ name: "", capacity: "", startsAt: "" });
  const [saving, setSaving] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    const res = await fetch(`/api/events/${eventId}/sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSaving(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      toast.error(d.error ?? "Erro ao criar sessão");
      return;
    }
    toast.success("Sessão criada");
    setForm({ name: "", capacity: "", startsAt: "" });
    onChange();
  }

  async function remove(id: string) {
    setRemovingId(id);
    const res = await fetch(`/api/events/${eventId}/sessions/${id}`, {
      method: "DELETE",
    });
    setRemovingId(null);
    if (!res.ok) {
      toast.error("Erro ao remover sessão");
      return;
    }
    toast.success("Sessão removida");
    onChange();
  }

  return (
    <div className="space-y-5 pt-4">
      <form onSubmit={add} className="flex flex-wrap items-end gap-2">
        <Input
          placeholder="Nome da sessão (ex.: Palestra 1)"
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          className="w-56"
          required
        />
        <Input
          placeholder="Horário (ex.: 14:00)"
          value={form.startsAt}
          onChange={(e) => setForm((f) => ({ ...f, startsAt: e.target.value }))}
          className="w-36"
        />
        <Input
          type="number"
          min={1}
          placeholder="Capacidade"
          value={form.capacity}
          onChange={(e) => setForm((f) => ({ ...f, capacity: e.target.value }))}
          className="w-32"
        />
        <Button type="submit" variant="secondary" disabled={saving}>
          {saving && <Loader2 className="size-4 animate-spin" />} Adicionar sessão
        </Button>
      </form>

      {sessions.length === 0 ? (
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icon={Clock}
              title="Nenhuma sessão"
              description="Crie sessões para controlar capacidade por horário (palestras, turnos)."
            />
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {sessions.map((s) => {
            const pct = s.capacity
              ? Math.min(100, Math.round((s.checkedIn / s.capacity) * 100))
              : 0;
            const full = s.capacity != null && s.checkedIn >= s.capacity;
            return (
              <Card key={s.id}>
                <CardContent className="space-y-2 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium">{s.name}</p>
                      {s.startsAt && (
                        <p className="text-xs text-muted-foreground">
                          {s.startsAt}
                        </p>
                      )}
                    </div>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label="Remover sessão"
                      disabled={removingId === s.id}
                      onClick={() => remove(s.id)}
                    >
                      <Trash2 className="text-destructive" />
                    </Button>
                  </div>
                  <p className="text-2xl font-bold tabular-nums">
                    {s.checkedIn}
                    <span className="text-base font-normal text-muted-foreground">
                      {" "}
                      / {s.capacity ?? "∞"} presentes
                    </span>
                  </p>
                  {s.capacity != null && (
                    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className={`h-full rounded-full transition-all ${full ? "bg-destructive" : "bg-success"}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {s.assigned} convidado(s) nesta sessão
                    {full ? " · lotada" : ""}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
