// Rótulos compartilhados dos status de evento e convidado (seção 2.1).

export const EVENT_STATUS_LABEL: Record<string, string> = {
  draft: "Rascunho",
  active: "Ativo",
  completed: "Encerrado",
  canceled: "Cancelado",
};

export const EVENT_STATUS_VARIANT: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  draft: "secondary",
  active: "default",
  completed: "outline",
  canceled: "destructive",
};

export const GUEST_STATUS_LABEL: Record<string, string> = {
  pending_qr: "QR pendente",
  qr_generated: "QR gerado",
  email_sent: "E-mail enviado",
  checked_in: "Check-in feito",
  no_show: "Não compareceu",
  canceled: "Removido",
};

export const GUEST_STATUS_VARIANT: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  pending_qr: "secondary",
  qr_generated: "outline",
  email_sent: "outline",
  checked_in: "default",
  no_show: "destructive",
  canceled: "destructive",
};
