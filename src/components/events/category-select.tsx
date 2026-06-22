"use client";

import { useMemo, useState } from "react";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

// Combobox de categoria (tier): escolhe de uma lista e permite criar uma nova
// categoria na hora se ela ainda não existir.
export function CategorySelect({
  value,
  onChange,
  options,
  placeholder = "Categoria…",
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return options.filter((o) => o.toLowerCase().includes(q));
  }, [options, query]);

  const exactMatch = options.some(
    (o) => o.toLowerCase() === query.trim().toLowerCase(),
  );
  const canCreate = query.trim().length > 0 && !exactMatch;

  function pick(v: string) {
    onChange(v);
    setQuery("");
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex h-9 items-center justify-between gap-2 rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring",
            className,
          )}
        >
          <span className={cn("truncate", !value && "text-muted-foreground")}>
            {value || placeholder}
          </span>
          <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-56 p-0">
        <div className="border-b p-2">
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar ou criar…"
            className="w-full rounded-md bg-transparent px-2 py-1.5 text-sm outline-none"
            onKeyDown={(e) => {
              if (e.key === "Enter" && canCreate) {
                e.preventDefault();
                pick(query.trim());
              }
            }}
          />
        </div>
        <div className="max-h-56 overflow-y-auto p-1">
          {value && (
            <button
              type="button"
              onClick={() => pick("")}
              className="flex w-full items-center rounded-md px-2 py-1.5 text-left text-sm text-muted-foreground hover:bg-accent"
            >
              Limpar categoria
            </button>
          )}
          {filtered.map((o) => (
            <button
              key={o}
              type="button"
              onClick={() => pick(o)}
              className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent"
            >
              <span className="truncate">{o}</span>
              {value === o && <Check className="size-4 text-primary" />}
            </button>
          ))}
          {filtered.length === 0 && !canCreate && (
            <p className="px-2 py-2 text-xs text-muted-foreground">
              Nenhuma categoria.
            </p>
          )}
          {canCreate && (
            <button
              type="button"
              onClick={() => pick(query.trim())}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm font-medium text-primary hover:bg-accent"
            >
              <Plus className="size-4" /> Criar “{query.trim()}”
            </button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
