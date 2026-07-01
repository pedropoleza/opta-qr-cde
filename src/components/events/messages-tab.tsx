"use client";

import { CreditCard, Clock, CalendarClock, UserPlus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { MessageScheduleModal } from "@/components/events/message-schedule-modal";

const PHASES = [
  {
    icon: UserPlus,
    tone: "bg-sky-500/15 text-sky-600",
    title: "No cadastro",
    desc: "Confirmação assim que a pessoa se inscreve.",
  },
  {
    icon: CreditCard,
    tone: "bg-emerald-500/15 text-emerald-600",
    title: "No pagamento",
    desc: "Entrega do ingresso (PDF + QR) ao confirmar o pagamento.",
  },
  {
    icon: Clock,
    tone: "bg-amber-500/15 text-amber-600",
    title: "Antes do evento",
    desc: "Lembretes agendados (dias/horas antes do início).",
  },
  {
    icon: CalendarClock,
    tone: "bg-violet-500/15 text-violet-600",
    title: "Depois do evento",
    desc: "Follow-up: agradecimento, pesquisa/NPS, certificado.",
  },
];

export function MessagesTab({
  eventId,
  eventName,
}: {
  eventId: string;
  eventName?: string;
}) {
  return (
    <div className="max-w-4xl space-y-5 pt-2">
      <Card>
        <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold">Jornada de mensagens</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Configure toda a comunicação do convidado numa única agenda — do
              cadastro ao pós-evento, com quanto tempo antes/depois e o que é enviado.
            </p>
          </div>
          <MessageScheduleModal eventId={eventId} eventName={eventName} />
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        {PHASES.map((p) => {
          const Icon = p.icon;
          return (
            <Card key={p.title}>
              <CardContent className="flex items-start gap-3 p-5">
                <span className={`flex size-9 shrink-0 items-center justify-center rounded-full ${p.tone}`}>
                  <Icon className="size-4" />
                </span>
                <div>
                  <p className="font-medium">{p.title}</p>
                  <p className="text-sm text-muted-foreground">{p.desc}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
