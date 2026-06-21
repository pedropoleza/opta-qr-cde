"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { CalendarPlus, Loader2, Tag, Users } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { PageHeader } from "@/components/ui/page-header";
import { SearchInput } from "@/components/ui/search-input";
import { EmptyState } from "@/components/ui/empty-state";
import { Loading, ErrorState } from "@/components/ui/states";

type EventRef = { id: string; name: string; status?: string };
type Contact = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  tags: string[];
  events: EventRef[];
};

export function ContactsClient({
  events,
}: {
  events: { id: string; name: string }[];
}) {
  const [query, setQuery] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [next, setNext] = useState<{ startAfter?: string; startAfterId: string } | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);

  const load = useCallback(
    async (
      q: string,
      tag: string,
      cursor?: { startAfter?: string; startAfterId: string },
    ) => {
      const isMore = Boolean(cursor);
      if (isMore) setLoadingMore(true);
      else setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      if (tag) params.set("tag", tag);
      else if (q) params.set("query", q);
      if (cursor?.startAfter) params.set("startAfter", cursor.startAfter);
      if (cursor?.startAfterId) params.set("startAfterId", cursor.startAfterId);
      try {
        const res = await fetch(`/api/contacts?${params.toString()}`);
        const data = await res.json();
        if (!res.ok) {
          setError(data.error ?? "Erro ao carregar contatos");
          if (!isMore) setContacts([]);
          return;
        }
        setContacts((prev) => (isMore ? [...prev, ...data.contacts] : data.contacts));
        setNext(data.next);
      } catch {
        setError("Falha de rede ao buscar contatos");
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [],
  );

  // Busca (debounce) ao digitar nome/tag.
  useEffect(() => {
    const t = setTimeout(() => load(query.trim(), tagFilter.trim()), 400);
    return () => clearTimeout(t);
  }, [query, tagFilter, load]);

  async function addToEvent(contact: Contact, event: { id: string; name: string }) {
    setAddingId(contact.id);
    const res = await fetch(`/api/events/${event.id}/guests/import-ghl`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contacts: [
          {
            ghlContactId: contact.id,
            name: contact.name,
            email: contact.email,
            phone: contact.phone,
          },
        ],
      }),
    });
    const data = await res.json().catch(() => ({}));
    setAddingId(null);
    if (!res.ok) {
      toast.error(data.error ?? "Erro ao adicionar ao evento");
      return;
    }
    if (data.created > 0) {
      toast.success(`${contact.name} adicionado a ${event.name}`);
      setContacts((prev) =>
        prev.map((c) =>
          c.id === contact.id
            ? { ...c, events: [...c.events, { id: event.id, name: event.name }] }
            : c,
        ),
      );
    } else {
      toast.info(`${contact.name} já estava em ${event.name}`);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Contatos"
        description="Contatos do Spark. Cadastre em eventos e veja em quais cada um já está."
      />

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <SearchInput
          placeholder="Buscar por nome, e-mail ou telefone"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          disabled={Boolean(tagFilter.trim())}
          className="w-full sm:max-w-md"
        />
        <div className="flex items-center gap-2">
          <Tag className="size-4 shrink-0 text-muted-foreground" />
          <Input
            placeholder="Filtrar por tag (ex.: convidado-evento)"
            value={tagFilter}
            onChange={(e) => setTagFilter(e.target.value)}
            className="w-full sm:w-64"
          />
          {tagFilter && (
            <Button variant="ghost" size="sm" onClick={() => setTagFilter("")}>
              Limpar
            </Button>
          )}
        </div>
      </div>
      {tagFilter.trim() && (
        <p className="-mt-3 text-xs text-muted-foreground">
          Mostrando contatos com a tag <strong>{tagFilter.trim()}</strong>.
        </p>
      )}

      <div className="rounded-lg border bg-card">
        {loading ? (
          <Loading label="Buscando contatos no Spark…" />
        ) : error ? (
          <ErrorState
            title="Não foi possível carregar"
            description={error}
            action={
              <Button variant="outline" asChild>
                <Link href="/connection">Ir para Conexão</Link>
              </Button>
            }
          />
        ) : contacts.length === 0 ? (
          <EmptyState
            icon={Users}
            title="Nenhum contato encontrado"
            description="Ajuste a busca ou verifique a conexão com o Spark."
          />
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Contato</TableHead>
                  <TableHead>Eventos</TableHead>
                  <TableHead className="w-44">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contacts.map((c) => {
                  const inEvent = new Set(c.events.map((e) => e.id));
                  return (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {c.email ?? c.phone ?? "—"}
                      </TableCell>
                      <TableCell>
                        {c.events.length === 0 ? (
                          <span className="text-sm text-muted-foreground">—</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {c.events.map((e) => (
                              <Link key={e.id} href={`/events/${e.id}`}>
                                <Badge variant="secondary" className="hover:bg-muted">
                                  {e.name}
                                </Badge>
                              </Link>
                            ))}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={addingId === c.id || events.length === 0}
                            >
                              {addingId === c.id ? (
                                <Loader2 className="size-4 animate-spin" />
                              ) : (
                                <CalendarPlus className="size-4" />
                              )}
                              Adicionar a evento
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="max-h-72 overflow-y-auto">
                            {events.map((ev) => (
                              <DropdownMenuItem
                                key={ev.id}
                                disabled={inEvent.has(ev.id)}
                                onClick={() => addToEvent(c, ev)}
                              >
                                {ev.name}
                                {inEvent.has(ev.id) ? " ✓" : ""}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            {next && (
              <div className="flex justify-center border-t p-3">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={loadingMore}
                  onClick={() => load(query.trim(), tagFilter.trim(), next)}
                >
                  {loadingMore && <Loader2 className="size-4 animate-spin" />}
                  Carregar mais
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
