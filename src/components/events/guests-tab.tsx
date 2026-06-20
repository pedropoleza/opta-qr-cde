"use client";

import { useRef, useState } from "react";
import Papa from "papaparse";
import { MoreHorizontal, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { toast } from "sonner";
import type { EventData, GuestRow } from "@/components/events/event-detail";
import { GUEST_STATUS_LABEL, GUEST_STATUS_VARIANT } from "@/components/events/status";

type CsvRow = Record<string, string>;

function pick(row: CsvRow, keys: string[]): string {
  for (const k of Object.keys(row)) {
    if (keys.includes(k.trim().toLowerCase())) return (row[k] ?? "").trim();
  }
  return "";
}

export function GuestsTab({
  event,
  guests,
  onChange,
}: {
  event: EventData;
  guests: GuestRow[];
  onChange: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [manual, setManual] = useState({ name: "", email: "", phone: "" });
  const [pendingRemove, setPendingRemove] = useState<GuestRow | null>(null);
  const [removing, setRemoving] = useState(false);
  const closed = ["completed", "canceled"].includes(event.status);

  async function postGuests(
    list: { name: string; email?: string; phone?: string }[],
    source: "csv" | "manual"
  ) {
    const res = await fetch(`/api/events/${event.id}/guests`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ guests: list, source }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(data.error ?? "Erro ao adicionar convidados");
      return false;
    }
    toast.success(`${data.created} convidado(s) adicionado(s)`);
    onChange();
    return true;
  }

  // Importação CSV (Etapa 2): colunas nome, e-mail, telefone.
  function handleCsv(file: File) {
    setImporting(true);
    Papa.parse<CsvRow>(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const list = results.data
          .map((row) => ({
            name: pick(row, ["name", "nome"]),
            email: pick(row, ["email", "e-mail"]),
            phone: pick(row, ["phone", "telefone", "celular"]),
          }))
          .filter((g) => g.name);
        if (list.length === 0) {
          toast.error("CSV sem linhas válidas — a coluna 'nome' é obrigatória");
        } else {
          await postGuests(list, "csv");
        }
        setImporting(false);
        if (fileRef.current) fileRef.current.value = "";
      },
      error: () => {
        toast.error("Falha ao ler o CSV");
        setImporting(false);
      },
    });
  }

  async function addManual(e: React.FormEvent) {
    e.preventDefault();
    if (!manual.name.trim()) return;
    if (await postGuests([manual], "manual")) {
      setManual({ name: "", email: "", phone: "" });
    }
  }

  async function manualCheckIn(guest: GuestRow) {
    const res = await fetch(`/api/events/${event.id}/guests/${guest.id}/checkin`, {
      method: "POST",
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(data.error ?? "Erro no check-in manual");
      return;
    }
    if (data.result === "checked_in") toast.success(`Check-in de ${guest.name} efetuado`);
    else if (data.result === "duplicate") toast.warning(`${guest.name} já fez check-in`);
    else toast.error(data.message ?? "Não foi possível efetuar o check-in");
    onChange();
  }

  async function confirmRemove() {
    const guest = pendingRemove;
    if (!guest) return;
    setRemoving(true);
    const res = await fetch(`/api/events/${event.id}/guests/${guest.id}`, {
      method: "DELETE",
    });
    setRemoving(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error ?? "Erro ao remover convidado");
      return;
    }
    toast.success("Convidado removido");
    setPendingRemove(null);
    onChange();
  }

  function copyLink(guest: GuestRow) {
    if (!guest.ticketToken) return;
    navigator.clipboard.writeText(`${window.location.origin}/q/${guest.ticketToken}`);
    toast.success("Link do QR copiado");
  }

  return (
    <div className="space-y-4 pt-4">
      {!closed && (
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleCsv(f);
              }}
            />
            <Button
              variant="outline"
              disabled={importing}
              onClick={() => fileRef.current?.click()}
            >
              {importing ? "Importando..." : "Importar CSV"}
            </Button>
          </div>
          <form onSubmit={addManual} className="flex flex-wrap items-end gap-2">
            <Input
              placeholder="Nome"
              value={manual.name}
              onChange={(e) => setManual((m) => ({ ...m, name: e.target.value }))}
              className="w-40"
              required
            />
            <Input
              placeholder="E-mail"
              type="email"
              value={manual.email}
              onChange={(e) => setManual((m) => ({ ...m, email: e.target.value }))}
              className="w-52"
            />
            <Input
              placeholder="Telefone"
              value={manual.phone}
              onChange={(e) => setManual((m) => ({ ...m, phone: e.target.value }))}
              className="w-36"
            />
            <Button type="submit" variant="secondary">
              Adicionar
            </Button>
          </form>
        </div>
      )}

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>E-mail</TableHead>
              <TableHead>Telefone</TableHead>
              <TableHead>Origem</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {guests.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="p-0">
                  <EmptyState
                    icon={Users}
                    title="Nenhum convidado ainda"
                    description="Importe um CSV (colunas: nome, email, telefone) ou adicione manualmente."
                  />
                </TableCell>
              </TableRow>
            )}
            {guests.map((guest) => (
              <TableRow key={guest.id}>
                <TableCell className="font-medium">{guest.name}</TableCell>
                <TableCell>{guest.email ?? "—"}</TableCell>
                <TableCell>{guest.phone ?? "—"}</TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {guest.source === "ghl"
                    ? "Spark"
                    : guest.source.toUpperCase()}
                </TableCell>
                <TableCell>
                  <Badge variant={GUEST_STATUS_VARIANT[guest.status] ?? "secondary"}>
                    {GUEST_STATUS_LABEL[guest.status] ?? guest.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon-sm" aria-label="Ações">
                        <MoreHorizontal />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {guest.ticketToken && (
                        <>
                          <DropdownMenuItem asChild>
                            <a
                              href={`/q/${guest.ticketToken}`}
                              target="_blank"
                              rel="noreferrer"
                            >
                              Ver QR
                            </a>
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => copyLink(guest)}>
                            Copiar link
                          </DropdownMenuItem>
                        </>
                      )}
                      {guest.status !== "canceled" &&
                        guest.status !== "checked_in" &&
                        guest.ticketToken && (
                          <DropdownMenuItem onClick={() => manualCheckIn(guest)}>
                            Marcar presença
                          </DropdownMenuItem>
                        )}
                      {guest.status !== "canceled" && (
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => setPendingRemove(guest)}
                        >
                          Remover
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ConfirmDialog
        open={pendingRemove !== null}
        onOpenChange={(open) => !open && setPendingRemove(null)}
        title="Remover convidado"
        description={
          pendingRemove
            ? `Remover ${pendingRemove.name} do evento? O QR Code dele deixa de valer.`
            : undefined
        }
        confirmLabel="Remover"
        destructive
        loading={removing}
        onConfirm={confirmRemove}
      />
    </div>
  );
}
