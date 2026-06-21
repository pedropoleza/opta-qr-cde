import { prisma } from "@/lib/prisma";

// Capacidade & lista de espera (Feature #1). "Confirmados" = convidados ativos
// (não cancelados) que NÃO estão na lista de espera. A lotação conta pessoas,
// então acompanhantes também ocupam vaga.

export type CapacityStatus = {
  capacity: number | null;
  confirmed: number;
  available: number | null; // null = sem teto definido
  waitlist: number;
  full: boolean;
};

export async function capacityStatus(eventId: string): Promise<CapacityStatus> {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { capacity: true },
  });
  const [confirmed, waitlist] = await Promise.all([
    prisma.guest.count({
      where: { eventId, waitlisted: false, status: { not: "canceled" } },
    }),
    prisma.guest.count({ where: { eventId, waitlisted: true } }),
  ]);
  const capacity = event?.capacity ?? null;
  const available = capacity == null ? null : Math.max(0, capacity - confirmed);
  return {
    capacity,
    confirmed,
    available,
    waitlist,
    full: capacity != null && confirmed >= capacity,
  };
}

// Quantas vagas livres existem ao adicionar `n` pessoas. Sem teto → cabe tudo.
export async function seatsAvailable(eventId: string): Promise<number | null> {
  const s = await capacityStatus(eventId);
  return s.available;
}

// Promove os mais antigos da lista de espera para confirmados, respeitando as
// vagas livres (ou um limite explícito). Retorna os convidados promovidos.
export async function promoteWaitlist(
  eventId: string,
  count?: number,
): Promise<{ id: string; name: string }[]> {
  const status = await capacityStatus(eventId);
  // Sem teto = promove todos (ou `count`). Com teto = no máximo as vagas livres.
  const room =
    status.available == null
      ? status.waitlist
      : Math.min(status.available, status.waitlist);
  const limit = count == null ? room : Math.min(room, count);
  if (limit <= 0) return [];

  return prisma.$transaction(async (tx) => {
    const next = await tx.guest.findMany({
      where: { eventId, waitlisted: true },
      orderBy: { createdAt: "asc" },
      take: limit,
      select: { id: true, name: true },
    });
    if (next.length === 0) return [];
    await tx.guest.updateMany({
      where: { id: { in: next.map((g) => g.id) } },
      data: { waitlisted: false },
    });
    return next;
  });
}
