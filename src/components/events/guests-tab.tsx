"use client";

import { useMemo, useRef, useState } from "react";
import Papa from "papaparse";
import {
  Copy,
  Eye,
  FileText,
  IdCard,
  Loader2,
  MoreHorizontal,
  RotateCcw,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ImportGhlDialog } from "@/components/events/import-ghl-dialog";
import { TierBadge } from "@/components/events/tier-badge";
import { CategorySelect } from "@/components/events/category-select";
import { toast } from "sonner";
import type {
  EventData,
  GuestRow,
  LogRow,
  SessionInfo,
} from "@/components/events/event-detail";
import { GUEST_STATUS_LABEL, GUEST_STATUS_VARIANT } from "@/components/events/status";
import {
  PAYMENT_STATUSES,
  PAYMENT_STATUS_LABEL,
  PAYMENT_STATUS_SHORT,
  PAYMENT_STATUS_TONE,
} from "@/lib/payment-status";

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
  undo: "Desfeito",
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

// #2 Grupo/acompanhantes: lista o titular + acompanhantes, permite renomear e
// adicionar um novo acompanhante (+1).
function GroupSection({
  detail,
  guests,
  onAdd,
  onRename,
}: {
  detail: GuestRow;
  guests: GuestRow[];
  onAdd: (host: GuestRow, name: string) => void;
  onRename: (guest: GuestRow, name: string) => void;
}) {
  const gid = detail.groupId ?? detail.id;
  const members = guests
    .filter((g) => (g.groupId ?? g.id) === gid && g.status !== "canceled")
    .sort((a, b) => (a.id === gid ? -1 : b.id === gid ? 1 : 0));
  const host = members.find((g) => g.id === gid) ?? detail;
  const [newName, setNewName] = useState("");
  const [edit, setEdit] = useState<Record<string, string>>({});

  return (
    <div className="space-y-2 rounded-lg border p-3">
      <p className="text-xs font-medium text-muted-foreground">
        Grupo · {members.length} pessoa{members.length > 1 ? "s" : ""}
      </p>
      <ul className="space-y-1.5">
        {members.map((m) => (
          <li key={m.id} className="flex items-center gap-2">
            <Input
              value={edit[m.id] ?? m.name}
              onChange={(e) => setEdit((s) => ({ ...s, [m.id]: e.target.value }))}
              className="h-8 flex-1 text-sm"
            />
            {m.id === gid ? (
              <Badge variant="secondary" className="text-xs">
                Titular
              </Badge>
            ) : (
              <Badge variant="outline" className="text-xs">
                +1
              </Badge>
            )}
            {(edit[m.id] ?? m.name) !== m.name && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onRename(m, (edit[m.id] ?? m.name).trim())}
              >
                Salvar
              </Button>
            )}
          </li>
        ))}
      </ul>
      <div className="flex items-center gap-2 pt-1">
        <Input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Nome do acompanhante"
          className="h-8 flex-1 text-sm"
        />
        <Button
          size="sm"
          variant="secondary"
          disabled={!newName.trim()}
          onClick={() => {
            onAdd(host, newName.trim());
            setNewName("");
          }}
        >
          + Acompanhante
        </Button>
      </div>
    </div>
  );
}

export function GuestsTab({
  event,
  guests,
  logs,
  sessions,
  appBaseUrl,
  onChange,
}: {
  event: EventData;
  guests: GuestRow[];
  logs: LogRow[];
  sessions: SessionInfo[];
  appBaseUrl: string;
  onChange: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [manual, setManual] = useState({
    name: "",
    email: "",
    phone: "",
    tier: "",
    companions: "",
  });
  const [savingTier, setSavingTier] = useState(false);
  const [syncingLeads, setSyncingLeads] = useState(false);
  const [pendingRemove, setPendingRemove] = useState<GuestRow | null>(null);
  const [removing, setRemoving] = useState(false);
  const [detail, setDetail] = useState<GuestRow | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const closed = ["completed", "canceled"].includes(event.status);

  // Categorias disponíveis: padrões + as já usadas pelos convidados (VIP é
  // tratado à parte pelo sinalizador VIP, então fica fora da lista).
  const categoryOptions = useMemo(() => {
    const set = new Set<string>(["Geral", "Imprensa", "Staff"]);
    for (const g of guests) {
      const t = g.tier?.trim();
      if (t && t.toLowerCase() !== "vip") set.add(t);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [guests]);

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
    list: {
      name: string;
      email?: string;
      phone?: string;
      tier?: string;
      companions?: number;
    }[],
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
    const payload = {
      name: manual.name,
      email: manual.email,
      phone: manual.phone,
      tier: manual.tier,
      companions: Number(manual.companions) || 0,
    };
    if (await postGuests([payload], "manual")) {
      setManual({ name: "", email: "", phone: "", tier: "", companions: "" });
    }
  }

  async function addCompanion(host: GuestRow, name: string) {
    const res = await fetch(
      `/api/events/${event.id}/guests/${host.id}/companions`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      },
    );
    const d = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(d.error ?? "Erro ao adicionar acompanhante");
      return;
    }
    toast.success(
      d.waitlisted ? "Acompanhante na lista de espera" : "Acompanhante adicionado",
    );
    onChange();
  }

  async function toggleVip(guest: GuestRow, vip: boolean) {
    const res = await fetch(`/api/events/${event.id}/guests/${guest.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vip }),
    });
    if (!res.ok) {
      toast.error("Erro ao atualizar VIP");
      return;
    }
    setDetail((d) => (d && d.id === guest.id ? { ...d, vip } : d));
    onChange();
  }

  async function renameGuest(guest: GuestRow, name: string) {
    const res = await fetch(`/api/events/${event.id}/guests/${guest.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) {
      toast.error("Erro ao renomear");
      return;
    }
    toast.success("Nome atualizado");
    onChange();
  }

  async function saveSession(guest: GuestRow, sessionId: string) {
    const value = sessionId === "none" ? null : sessionId;
    const res = await fetch(`/api/events/${event.id}/guests/${guest.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: value }),
    });
    if (!res.ok) {
      toast.error("Erro ao definir sessão");
      return;
    }
    toast.success("Sessão atualizada");
    setDetail((d) => (d && d.id === guest.id ? { ...d, sessionId: value } : d));
    onChange();
  }

  async function checkInGroup(guest: GuestRow) {
    setBusyId(guest.id);
    const res = await fetch(
      `/api/events/${event.id}/guests/${guest.id}/checkin-group`,
      { method: "POST" },
    );
    setBusyId(null);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(data.error ?? "Erro no check-in do grupo");
      return;
    }
    toast.success(
      `Grupo: ${data.checkedIn} entrada(s)${data.alreadyIn ? `, ${data.alreadyIn} já presente(s)` : ""}`,
    );
    onChange();
  }

  async function saveTier(guest: GuestRow, tier: string) {
    setSavingTier(true);
    const res = await fetch(`/api/events/${event.id}/guests/${guest.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tier: tier.trim() || null }),
    });
    setSavingTier(false);
    if (!res.ok) {
      toast.error("Erro ao salvar categoria");
      return;
    }
    toast.success("Categoria salva");
    const value = tier.trim() || null;
    setDetail((d) => (d && d.id === guest.id ? { ...d, tier: value } : d));
    onChange();
  }

  async function syncLeads() {
    setSyncingLeads(true);
    const res = await fetch(`/api/events/${event.id}/sync-leads`, {
      method: "POST",
    });
    setSyncingLeads(false);
    const d = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(d.error ?? "Erro ao sincronizar leads");
      return;
    }
    if (d.created > 0 || d.updated > 0) {
      toast.success(
        `Leads sincronizados: ${d.created} novo(s)${d.updated ? `, ${d.updated} atualizado(s)` : ""}`,
      );
      onChange();
    } else {
      toast.info(`Nenhum lead novo com a tag "${d.tag ?? event.ghlTag ?? ""}"`);
    }
  }

  async function savePayment(guest: GuestRow, paymentStatus: string) {
    const res = await fetch(`/api/events/${event.id}/guests/${guest.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paymentStatus }),
    });
    if (!res.ok) {
      toast.error("Erro ao atualizar pagamento");
      return;
    }
    toast.success("Pagamento atualizado");
    setDetail((d) => (d && d.id === guest.id ? { ...d, paymentStatus } : d));
    onChange();
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

  async function undoCheckIn(guest: GuestRow) {
    setBusyId(guest.id);
    const res = await fetch(
      `/api/events/${event.id}/guests/${guest.id}/uncheckin`,
      { method: "POST" },
    );
    setBusyId(null);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(data.error ?? "Erro ao desfazer check-in");
      return;
    }
    toast.success(`Check-in de ${guest.name} desfeito`);
    setDetail((d) => (d && d.id === guest.id ? { ...d, status: "email_sent" } : d));
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
          <ImportGhlDialog eventId={event.id} defaultTag={event.ghlTag} onChange={onChange} />
          {event.ghlTag && (
            <Button
              variant="outline"
              disabled={syncingLeads}
              onClick={syncLeads}
              title={`Puxa contatos com a tag "${event.ghlTag}" como convidados aguardando pagamento`}
            >
              {syncingLeads ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <RotateCcw className="size-4" />
              )}
              Sincronizar leads
            </Button>
          )}
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
            <CategorySelect
              value={manual.tier}
              onChange={(v) => setManual((m) => ({ ...m, tier: v }))}
              options={categoryOptions}
              placeholder="Categoria (Geral…)"
              className="w-40"
            />
            <Input
              type="number"
              min={0}
              max={20}
              placeholder="+Acomp."
              value={manual.companions}
              onChange={(e) =>
                setManual((m) => ({ ...m, companions: e.target.value }))
              }
              className="w-24"
              title="Acompanhantes (cria o grupo)"
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
                <TableCell className="font-medium">
                  <span className="flex items-center gap-2">
                    {guest.name}
                    {(guest.vip || guest.tier?.toLowerCase() === "vip") && (
                      <Badge className="border-transparent bg-amber-400 text-xs text-amber-950">
                        ⭐ VIP
                      </Badge>
                    )}
                    {guest.tier?.toLowerCase() !== "vip" && (
                      <TierBadge tier={guest.tier} />
                    )}
                    {guest.groupSize > 1 && (
                      <Badge variant="outline" className="text-xs">
                        Grupo {guest.groupSize}
                      </Badge>
                    )}
                  </span>
                </TableCell>
                <TableCell>{guest.email ?? "—"}</TableCell>
                <TableCell>{guest.phone ?? "—"}</TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {guest.source === "ghl" ? "Spark" : guest.source.toUpperCase()}
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {guest.waitlisted ? (
                      <Badge variant="secondary">Lista de espera</Badge>
                    ) : (
                      <Badge variant={GUEST_STATUS_VARIANT[guest.status] ?? "secondary"}>
                        {GUEST_STATUS_LABEL[guest.status] ?? guest.status}
                      </Badge>
                    )}
                    {guest.paymentStatus !== "none" && (
                      <Badge
                        className={`border-transparent text-xs ${
                          PAYMENT_STATUS_TONE[guest.paymentStatus] ??
                          PAYMENT_STATUS_TONE.none
                        }`}
                      >
                        {PAYMENT_STATUS_SHORT[guest.paymentStatus] ??
                          guest.paymentStatus}
                      </Badge>
                    )}
                  </div>
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
                  <TierBadge tier={detail.tier} />
                  {detail.paymentStatus !== "none" && (
                    <Badge
                      className={`border-transparent text-xs ${
                        PAYMENT_STATUS_TONE[detail.paymentStatus] ??
                        PAYMENT_STATUS_TONE.none
                      }`}
                    >
                      {PAYMENT_STATUS_LABEL[detail.paymentStatus] ??
                        detail.paymentStatus}
                    </Badge>
                  )}
                  {detail.rsvp === "yes" && (
                    <Badge className="border-transparent bg-success text-xs text-success-foreground">
                      Confirmou presença
                    </Badge>
                  )}
                  {detail.rsvp === "no" && (
                    <Badge variant="secondary" className="text-xs">
                      Não vai
                    </Badge>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground">
                    Categoria
                  </label>
                  <CategorySelect
                    value={detail.tier ?? ""}
                    onChange={(v) => saveTier(detail, v)}
                    options={categoryOptions}
                    placeholder="Geral, Imprensa…"
                    className="w-full"
                  />
                  {savingTier && (
                    <p className="text-xs text-muted-foreground">Salvando…</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground">
                    Status do pagamento
                  </label>
                  <Select
                    value={detail.paymentStatus}
                    onValueChange={(v) => savePayment(detail, v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PAYMENT_STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {PAYMENT_STATUS_LABEL[s]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Atualiza automaticamente para{" "}
                    <strong>Pagamento realizado</strong> quando o Square confirmar.
                  </p>
                </div>

                {sessions.length > 0 && (
                  <div className="space-y-1.5">
                    <label className="text-xs text-muted-foreground">Sessão</label>
                    <Select
                      value={detail.sessionId ?? "none"}
                      onValueChange={(v) => saveSession(detail, v)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sem sessão</SelectItem>
                        {sessions.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.name}
                            {s.startsAt ? ` · ${s.startsAt}` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <p className="text-sm font-medium">Convidado VIP</p>
                    <p className="text-xs text-muted-foreground">
                      Arte especial no ingresso e no crachá + aviso ao anfitrião na
                      chegada. Independe da categoria.
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant={detail.vip ? "default" : "outline"}
                    onClick={() => toggleVip(detail, !detail.vip)}
                  >
                    {detail.vip ? "⭐ VIP ativo" : "Marcar VIP"}
                  </Button>
                </div>

                <GroupSection
                  detail={detail}
                  guests={guests}
                  onAdd={addCompanion}
                  onRename={renameGuest}
                />

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
                    <div className="grid grid-cols-2 gap-2">
                      <Button variant="outline" asChild>
                        <a
                          href={`/api/ticket/${detail.ticketToken}/pdf`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <FileText /> Ingresso PDF
                        </a>
                      </Button>
                      <Button variant="outline" asChild>
                        <a
                          href={`/api/ticket/${detail.ticketToken}/badge`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <IdCard /> Crachá
                        </a>
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
            {detail && detail.groupSize > 1 && (
              <Button
                variant="outline"
                disabled={busyId === detail.id}
                onClick={() => checkInGroup(detail)}
              >
                <Users /> Entrada do grupo ({detail.groupSize})
              </Button>
            )}
            {detail && detail.status === "checked_in" && (
              <Button
                variant="outline"
                disabled={busyId === detail.id}
                onClick={() => undoCheckIn(detail)}
              >
                <RotateCcw /> Desfazer check-in
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
