"use client";

import { useMemo, useRef, useState } from "react";
import { Loader2, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  WHATSAPP_LANGUAGES,
  DEFAULT_WHATSAPP_MESSAGES,
  type WhatsappMessages,
} from "@/lib/languages";

const VARIABLES = [
  { key: "nome", label: "Nome do convidado" },
  { key: "evento", label: "Nome do evento" },
  { key: "data", label: "Data" },
  { key: "hora", label: "Horário" },
  { key: "local", label: "Local" },
  { key: "link_qr", label: "Link do ingresso" },
];

function preview(text: string): string {
  return text
    .replace(/\{\{\s*nome\s*\}\}/gi, "Maria Silva")
    .replace(/\{\{\s*evento\s*\}\}/gi, "Vinhos, Mulheres e Riqueza")
    .replace(/\{\{\s*data\s*\}\}/gi, "21/06/2026")
    .replace(/\{\{\s*hora\s*\}\}/gi, "19:00")
    .replace(/\{\{\s*local\s*\}\}/gi, "Vertex Coworking")
    .replace(/\{\{\s*link_qr\s*\}\}/gi, "opta.com/q/abc123");
}

export function WhatsappMessageEditor({
  eventId,
  initial,
  onSaved,
}: {
  eventId: string;
  initial: WhatsappMessages | null;
  onSaved?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const base = initial ?? DEFAULT_WHATSAPP_MESSAGES;
  const [defaultLang, setDefaultLang] = useState(base.default);
  const [langs, setLangs] = useState<Record<string, string>>(() => {
    const out: Record<string, string> = {};
    for (const l of WHATSAPP_LANGUAGES) {
      out[l.code] = base.langs?.[l.code] ?? DEFAULT_WHATSAPP_MESSAGES.langs[l.code] ?? "";
    }
    return out;
  });
  const [editing, setEditing] = useState(base.default);
  const taRef = useRef<HTMLTextAreaElement>(null);

  const text = langs[editing] ?? "";
  const previewText = useMemo(() => preview(text), [text]);

  function setText(v: string) {
    setLangs((s) => ({ ...s, [editing]: v }));
  }

  function insertVar(key: string) {
    const ta = taRef.current;
    const token = `{{${key}}}`;
    if (!ta) {
      setText(text + token);
      return;
    }
    const start = ta.selectionStart ?? text.length;
    const end = ta.selectionEnd ?? text.length;
    const next = text.slice(0, start) + token + text.slice(end);
    setText(next);
    requestAnimationFrame(() => {
      ta.focus();
      const pos = start + token.length;
      ta.setSelectionRange(pos, pos);
    });
  }

  async function save() {
    setSaving(true);
    const res = await fetch(`/api/events/${eventId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        whatsappMessages: { default: defaultLang, langs },
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      toast.error(d.error ?? "Erro ao salvar a mensagem");
      return;
    }
    toast.success("Mensagem do WhatsApp salva");
    setOpen(false);
    onSaved?.();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <MessageCircle /> Mensagem do WhatsApp
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] w-[96vw] max-w-2xl overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Mensagem do WhatsApp</DialogTitle>
          <DialogDescription>
            Texto que acompanha o PDF do ingresso. Configure um por idioma — o
            idioma de cada convidado decide qual mensagem é enviada.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Idioma padrão + idioma em edição */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Idioma padrão do evento</Label>
              <Select value={defaultLang} onValueChange={setDefaultLang}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WHATSAPP_LANGUAGES.map((l) => (
                    <SelectItem key={l.code} value={l.code}>
                      {l.flag} {l.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Editando o idioma</Label>
              <Select value={editing} onValueChange={setEditing}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WHATSAPP_LANGUAGES.map((l) => (
                    <SelectItem key={l.code} value={l.code}>
                      {l.flag} {l.label}
                      {l.code === defaultLang ? " · padrão" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Variáveis */}
          <div className="flex flex-wrap gap-1.5">
            {VARIABLES.map((v) => (
              <button
                key={v.key}
                type="button"
                onClick={() => insertVar(v.key)}
                title={v.label}
                className="rounded-full border bg-muted px-2.5 py-1 text-xs font-medium hover:bg-accent"
              >
                {"{{"}
                {v.key}
                {"}}"}
              </button>
            ))}
          </div>

          {/* Editor + prévia */}
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Mensagem</Label>
              <textarea
                ref={taRef}
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={9}
                className="w-full resize-none rounded-md border bg-background p-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                placeholder="Escreva a mensagem… use as variáveis acima."
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Prévia</Label>
              <div className="h-full whitespace-pre-wrap rounded-md border bg-[#e7ffdb] p-3 text-sm text-neutral-800">
                {previewText || (
                  <span className="text-muted-foreground">A prévia aparece aqui.</span>
                )}
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            Salvar mensagem
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
