// Rótulos e tons profissionais para o status de pagamento do convidado.
// Fonte única para todas as superfícies (lista de convidados, pagamentos,
// detalhe do convidado) — mantém a terminologia consistente e formal.

export type PaymentStatus = "none" | "pending" | "paid" | "refunded" | "failed";

export const PAYMENT_STATUSES: PaymentStatus[] = [
  "none",
  "pending",
  "paid",
  "refunded",
  "failed",
];

// Rótulo completo (badges e seletores).
export const PAYMENT_STATUS_LABEL: Record<string, string> = {
  none: "Sem cobrança",
  pending: "Aguardando pagamento",
  paid: "Pagamento realizado",
  refunded: "Reembolsado",
  failed: "Pagamento recusado",
};

// Rótulo curto (colunas estreitas).
export const PAYMENT_STATUS_SHORT: Record<string, string> = {
  none: "Sem cobrança",
  pending: "Aguardando",
  paid: "Pago",
  refunded: "Reembolsado",
  failed: "Recusado",
};

// Classes de cor (Tailwind) — usa a mesma paleta do restante do app.
export const PAYMENT_STATUS_TONE: Record<string, string> = {
  none: "bg-muted text-muted-foreground",
  pending: "bg-amber-500/15 text-amber-700",
  paid: "bg-emerald-500/15 text-emerald-700",
  refunded: "bg-sky-500/15 text-sky-700",
  failed: "bg-rose-500/15 text-rose-700",
};

export function paymentStatusLabel(status: string | null | undefined): string {
  return PAYMENT_STATUS_LABEL[status ?? "none"] ?? status ?? "—";
}
