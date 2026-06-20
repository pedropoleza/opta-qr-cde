"use client";

import { ScanLine } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import type { LogRow } from "@/components/events/event-detail";

const LOG_LABEL: Record<string, string> = {
  checked_in: "Check-in",
  duplicate: "Duplicado",
  invalid: "Inválido",
  wrong_event: "Outro evento",
};

const LOG_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  checked_in: "default",
  duplicate: "secondary",
  invalid: "destructive",
  wrong_event: "outline",
};

export function ActivityTab({ logs }: { logs: LogRow[] }) {
  return (
    <div className="rounded-lg border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Quando</TableHead>
            <TableHead>Resultado</TableHead>
            <TableHead>Convidado</TableHead>
            <TableHead>Mensagem</TableHead>
            <TableHead>Dispositivo</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {logs.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="p-0">
                <EmptyState
                  icon={ScanLine}
                  title="Nenhum scan registrado"
                  description="Os check-ins e tentativas aparecem aqui assim que o Checker começar a escanear."
                />
              </TableCell>
            </TableRow>
          )}
          {logs.map((log) => (
            <TableRow key={log.id}>
              <TableCell className="whitespace-nowrap">
                {new Date(log.scannedAt).toLocaleString("pt-BR")}
              </TableCell>
              <TableCell>
                <Badge variant={LOG_VARIANT[log.status] ?? "secondary"}>
                  {LOG_LABEL[log.status] ?? log.status}
                </Badge>
              </TableCell>
              <TableCell>{log.guestName ?? "—"}</TableCell>
              <TableCell>{log.message ?? "—"}</TableCell>
              <TableCell className="max-w-48 truncate text-xs text-muted-foreground">
                {log.deviceInfo ?? "—"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
