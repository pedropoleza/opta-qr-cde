"use client";

import { useMemo, useRef, useState } from "react";
import Papa from "papaparse";
import {
  Copy,
  Eye,
  Loader2,
  MoreHorizontal,
  Send,
  Trash2,
  UserCheck,
  Users,
} from "lucide-react";
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
import {
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { SearchInput } from "@/components/ui/search-input";
import { toast } from "sonner";
import type { EventData, GuestRow, LogRow } from "@/components/events/event-detail";
import { GUEST_STATUS_LABEL, GUEST_STATUS_VARIANT } from "@/components/events/status";

type CsvRow = Record<string, string>;

function pick(row: CsvRow, keys: string[]): string {
  for (const k of Object.keys(row)) {
    if (keys.includes(k.trim().toLowerCase())) return (row[k] ?? "").trim();
  }
  return "";
}

const LOG_LABEL: Record<string, string> = {
  checked_in: "Check-in",
  duplicate: "Duplicado",
  invalid: "Inválido",
  wrong_event: "Outro evento",
};

// Filtros rápidos por status.
const FILTERS: { value: string; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "pending", label: "Sem QR" },
  { value: "qr_generated", label: "QR gerado" },
  { value: "email_sent", label: "Enviado" },
  { value: "checked_in", label: "Check-in" },
];

function matchesFilter(status: string, filter: string) {
  if (filter === "all") return true;
  if (filter === "pending") return status === "pending_qr";
  return status === filter;
}

export function GuestsTab({
  event,
  guests,
  logs,
  appBaseUrl,
  onChange,
}: {
  event: EventData;
  guests: GuestRow[];
  logs: LogRow[];
  appBaseUrl: string;
  onChange: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [manual, setManual] = useState({ name: "", email: "", phone: "" });
  const [pendingRemove, setPendingRemove] = useState<GuestRow | null>(null);
  const [removing, setRemoving] = useState(false);
  const [detail, setDetail] = useState<GuestRow | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const closed = ["completed", "canceled"].includes(event.status);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return guests.filter((g) => {
      const matchesQuery =
        !q ||
        g.name.toLowerCase().includes(q) ||
        (g.email ?? "").toLowerCase().includes(q) ||
        (g.phone ?? "").toLowerCase().includes(q);
      return matchesQuery && matchesFilter(g.status, filter);
    });
  }, [guests, query, filter]);

  const detailLogs = useMemo(
    () => (detail ? logs.filter((l) => l.guestId === detail.id) : []),
    [logs, detail],
  );

  async function postGuests(
    list: { name: string; email?: string; phone?: string }[],
    source: "csv" | "manual",
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
    setBusyId(guest.id);
    const res = await fetch(`/api/events/${event.id}/guests/${guest.id}/checkin`, {
      method: "POST",
    });
    setBusyId(null);
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

  async function sendInvite(guest: GuestRow) {
    setBusyId(guest.id);
    const res = await fetch(`/api/events/${event.id}/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ guestIds: [guest.id] }),
    });
    setBusyId(null);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(data.error ?? "Erro ao enviar convite");
      return;
    }
    toast.success(`Convite de ${guest.name} disparado`);
    if (data.withoutGhlContact > 0) {
      toast.warning(`${guest.name} ainda sem contato Spark vinculado — entra na fila`);
    }
    setDetail((d) => (d && d.id === guest.id ? { ...d, status: "email_sent" } : d));
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
    if (detail?.id === guest.id) setDetail(null);
    onChange();
  }

  function copyLink(token: string) {
    navigator.clipboard.writeText(`${appBaseUrl}/q/${token}`);
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

      {/* #1 Busca + filtros */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SearchInput
          placeholder="Buscar por nome, e-mail ou telefone"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full sm:max-w-xs"
        />
        <div className="flex flex-wrap gap-1">
          {FILTERS.map((f) => (
            <Button
              key={f.value}
              size="sm"
              variant={filter === f.value ? "default" : "outline"}
              onClick={() => setFilter(f.value)}
            >
              {f.label}
            </Button>
          ))}
        </div>
      </div>

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
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="p-0">
                  <EmptyState
                    icon={Users}
                    title={
                      guests.length === 0
                        ? "Nenhum convidado ainda"
                        : "Nenhum convidado encontrado"
                    }
                    description={
                      guests.length === 0
                        ? "Importe um CSV (colunas: nome, email, telefone) ou adicione manualmente."
                        : "Ajuste a busca ou os filtros acima."
                    }
                  />
                </TableCell>
              </TableRow>
            )}
            {filtered.map((guest) => (
              <TableRow
                key={guest.id}
                role="button"
                tabIndex={0}
                aria-label={`Ver ${guest.name}`}
                onClick={() => setDetail(guest)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setDetail(guest);
                  }
                }}
                className="cursor-pointer"
              >
                <TableCell className="font-medium">{guest.name}</TableCell>
                <TableCell>{guest.email ?? "—"}</TableCell>
                <TableCell>{guest.phone ?? "—"}</TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {guest.source === "ghl" ? "Spark" : guest.source.toUpperCase()}
                </TableCell>
                <TableCell>
                  <Badge variant={GUEST_STATUS_VARIANT[guest.status] ?? "secondary"}>
                    {GUEST_STATUS_LABEL[guest.status] ?? guest.status}
                  </Badge>
                </TableCell>
                <TableCell
                  onClick={(e) => e.stopPropagation()}
                  className="w-12"
                >
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon-sm" aria-label="Ações">
                        <MoreHorizontal />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setDetail(guest)}>
                        <Eye className="size-4" /> Ver detalhes
                      </DropdownMenuItem>
                      {guest.ticketToken && (
                        <DropdownMenuItem onClick={() => copyLink(guest.ticketToken!)}>
                          <Copy className="size-4" /> Copiar link
                        </DropdownMenuItem>
                      )}
                      {guest.status !== "canceled" &&
                        guest.status !== "checked_in" &&
                        guest.ticketToken && (
                          <DropdownMenuItem onClick={() => manualCheckIn(guest)}>
                            <UserCheck className="size-4" /> Marcar presença
                          </DropdownMenuItem>
                        )}
                      {guest.status !== "canceled" && (
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => setPendingRemove(guest)}
                        >
                          <Trash2 className="size-4" /> Remover
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

      {/* #2 Drawer de detalhe do convidado */}
      <Drawer
        open={detail !== null}
        onOpenChange={(open) => {
          if (!open) setDetail(null);
        }}
      >
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>{detail?.name}</DrawerTitle>
            <DrawerDescription>
              {detail?.email ?? "Sem e-mail"}
              {detail?.phone ? ` · ${detail.phone}` : ""}
            </DrawerDescription>
          </DrawerHeader>
          <DrawerBody className="space-y-5">
            {detail && (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={GUEST_STATUS_VARIANT[detail.status] ?? "secondary"}>
                    {GUEST_STATUS_LABEL[detail.status] ?? detail.status}
                  </Badge>
                  <EmailDeliveryBadge
                    status={detail.emailStatus}
                    sentAt={detail.emailSentAt}
                  />
                </div>

                {detail.ticketToken ? (
                  <div className="space-y-2">
                    <div className="flex justify-center">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={`/api/qr/${detail.ticketToken}`}
                        alt={`QR de ${detail.name}`}
                        className="h-44 w-44 rounded-lg border bg-white p-2"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 truncate rounded-md bg-muted px-2 py-1.5 text-xs">
                        {appBaseUrl}/q/{detail.ticketToken}
                      </code>
                      <Button
                        size="icon-sm"
                        variant="outline"
                        aria-label="Copiar link"
                        onClick={() => copyLink(detail.ticketToken!)}
                      >
                        <Copy />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="rounded-md bg-muted p-3 text-xs text-muted-foreground">
                    QR ainda não gerado. Gere os QR Codes na aba QR Delivery.
                  </p>
                )}

                <div>
                  <p className="mb-2 text-xs font-medium text-muted-foreground">
                    Histórico de scans ({detailLogs.length})
                  </p>
                  {detailLogs.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Nenhum scan registrado.
                    </p>
                  ) : (
                    <ul className="space-y-1.5">
                      {detailLogs.map((l) => (
                        <li
                          key={l.id}
                          className="flex items-center justify-between gap-2 rounded-md border px-2.5 py-1.5 text-xs"
                        >
                          <span>{LOG_LABEL[l.status] ?? l.status}</span>
                          <span className="text-muted-foreground">
                            {new Date(l.scannedAt).toLocaleString("pt-BR")}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </>
            )}
          </DrawerBody>
          <DrawerFooter>
            {detail && detail.status !== "canceled" && (
              <Button
                variant="destructive"
                onClick={() => setPendingRemove(detail)}
              >
                <Trash2 /> Remover
              </Button>
            )}
            {detail &&
              detail.status !== "canceled" &&
              detail.status !== "checked_in" &&
              detail.ticketToken && (
                <Button
                  variant="outline"
                  disabled={busyId === detail.id}
                  onClick={() => manualCheckIn(detail)}
                >
                  <UserCheck /> Marcar presença
                </Button>
              )}
            {detail && detail.ticketToken && detail.status !== "checked_in" && (
              <Button
                disabled={busyId === detail.id}
                onClick={() => sendInvite(detail)}
              >
                {busyId === detail.id ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <Send />
                )}
                {detail.status === "email_sent" ? "Reenviar" : "Enviar convite"}
              </Button>
            )}
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

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

// #3 Badge de entrega do e-mail (queued/sent/error).
function EmailDeliveryBadge({
  status,
  sentAt,
}: {
  status: string | null;
  sentAt: string | null;
}) {
  if (!status) {
    return (
      <Badge variant="outline" className="text-xs">
        E-mail não enviado
      </Badge>
    );
  }
  if (status === "sent") {
    return (
      <Badge className="border-transparent bg-success text-xs text-success-foreground">
        Entregue ao Spark
        {sentAt ? ` · ${new Date(sentAt).toLocaleDateString("pt-BR")}` : ""}
      </Badge>
    );
  }
  if (status === "error") {
    return (
      <Badge variant="destructive" className="text-xs">
        Erro no envio
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="text-xs">
      E-mail enfileirado
    </Badge>
  );
}
