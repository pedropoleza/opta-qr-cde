"use client";

import { useEffect, useState } from "react";
import { Loader2, MessagesSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  CreationMessages,
  loadDraftFromEvent,
  replaceMessages,
  emptyDraft,
  type MsgDraft,
} from "@/components/events/creation-messages";

export function MessagesTab({
  eventId,
  eventName,
}: {
  eventId: string;
  eventName?: string;
}) {
  const [draft, setDraft] = useState<MsgDraft | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadDraftFromEvent(eventId)
      .then(setDraft)
      .catch(() => setDraft(emptyDraft));
  }, [eventId]);

  async function save() {
    if (!draft) return;
    setSaving(true);
    await replaceMessages(eventId, draft);
    setSaving(false);
    toast.success("Mensagens salvas");
  }

  if (!draft) {
    return (
      <p className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Carregando mensagens…
      </p>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5 pb-24 pt-2">
      <div className="flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <MessagesSquare className="size-5" />
        </span>
        <div>
          <h2 className="text-lg font-semibold leading-tight">
            Mensagens{eventName ? ` — ${eventName}` : ""}
          </h2>
          <p className="text-sm text-muted-foreground">
            Jornada completa: cadastro, pagamento e lembretes (antes/depois).
          </p>
        </div>
      </div>

      <CreationMessages value={draft} onChange={setDraft} />

      {/* Barra de ação fixa */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t bg-card/90 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-end gap-3 px-4 py-3">
          <p className="mr-auto text-sm text-muted-foreground">
            As alterações são aplicadas ao salvar.
          </p>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            Salvar mensagens
          </Button>
        </div>
      </div>
    </div>
  );
}
