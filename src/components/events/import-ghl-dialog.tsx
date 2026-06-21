"use client";

import { useState } from "react";
import { Loader2, Search, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Loading } from "@/components/ui/states";
import { EmptyState } from "@/components/ui/empty-state";

type Contact = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  tags: string[];
};

// #9 Importar contatos do Spark por tag: busca, seleciona (todos por padrão) e
// importa como convidados com ghl_contact_id.
export function ImportGhlDialog({
  eventId,
  defaultTag,
  onChange,
}: {
  eventId: string;
  defaultTag?: string | null;
  onChange: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [tag, setTag] = useState(defaultTag ?? "");
  const [loading, setLoading] = useState(false);
  const [contacts, setContacts] = useState<Contact[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);

  function reset() {
    setTag(defaultTag ?? "");
    setContacts(null);
    setSelected(new Set());
  }

  async function search() {
    const t = tag.trim();
    if (!t) return;
    setLoading(true);
    setContacts(null);
    const res = await fetch(`/api/ghl/contacts?tag=${encodeURIComponent(t)}`);
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      toast.error(data.error ?? "Erro ao buscar contatos");
      return;
    }
    const list: Contact[] = data.contacts ?? [];
    setContacts(list);
    setSelected(new Set(list.map((c) => c.id)));
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (!contacts) return;
    setSelected((prev) =>
      prev.size === contacts.length ? new Set() : new Set(contacts.map((c) => c.id)),
    );
  }

  async function importSelected() {
    if (!contacts) return;
    const chosen = contacts
      .filter((c) => selected.has(c.id))
      .map((c) => ({
        ghlContactId: c.id,
        name: c.name,
        email: c.email,
        phone: c.phone,
      }));
    if (chosen.length === 0) {
      toast.info("Selecione ao menos um contato");
      return;
    }
    setImporting(true);
    const res = await fetch(`/api/events/${eventId}/guests/import-ghl`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contacts: chosen }),
    });
    const data = await res.json().catch(() => ({}));
    setImporting(false);
    if (!res.ok) {
      toast.error(data.error ?? "Erro ao importar");
      return;
    }
    toast.success(
      `${data.created} convidado(s) importado(s)` +
        (data.skipped ? ` · ${data.skipped} já existia(m)` : ""),
    );
    onChange();
    setOpen(false);
    reset();
  }

  const allSelected = contacts != null && selected.size === contacts.length;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline">
          <Sparkles className="size-4" /> Importar do Spark
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Importar contatos do Spark</DialogTitle>
          <DialogDescription>
            Busque por uma tag e selecione quem entra como convidado. Eles vêm
            com o contato vinculado, então o e-mail do convite pode disparar.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            search();
          }}
          className="flex items-center gap-2"
        >
          <Input
            placeholder="Tag (ex.: convidado-meu-evento)"
            value={tag}
            onChange={(e) => setTag(e.target.value)}
            autoFocus
          />
          <Button type="submit" disabled={loading || !tag.trim()}>
            {loading ? <Loader2 className="animate-spin" /> : <Search />}
            Buscar
          </Button>
        </form>

        <div className="max-h-72 overflow-y-auto rounded-lg border">
          {loading && <Loading label="Buscando no Spark…" />}
          {!loading && contacts === null && (
            <EmptyState
              icon={Search}
              title="Busque por uma tag"
              description="Os contatos com a tag aparecem aqui para você selecionar."
            />
          )}
          {!loading && contacts !== null && contacts.length === 0 && (
            <EmptyState
              icon={Search}
              title="Nenhum contato com essa tag"
              description="Confira a tag no Spark e tente novamente."
            />
          )}
          {!loading && contacts !== null && contacts.length > 0 && (
            <ul className="divide-y">
              <li className="sticky top-0 flex items-center gap-2 bg-muted/60 px-3 py-2 text-xs font-medium backdrop-blur">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  className="size-4 accent-primary"
                  aria-label="Selecionar todos"
                />
                Selecionar todos ({contacts.length})
              </li>
              {contacts.map((c) => (
                <li key={c.id}>
                  <label className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-muted/40">
                    <input
                      type="checkbox"
                      checked={selected.has(c.id)}
                      onChange={() => toggle(c.id)}
                      className="size-4 accent-primary"
                    />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">
                        {c.name}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {c.email ?? c.phone ?? "sem contato"}
                      </span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              setOpen(false);
              reset();
            }}
          >
            Cancelar
          </Button>
          <Button
            onClick={importSelected}
            disabled={importing || selected.size === 0}
          >
            {importing && <Loader2 className="animate-spin" />}
            Importar ({selected.size})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
