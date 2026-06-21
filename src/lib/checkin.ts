import { prisma } from "@/lib/prisma";
import {
  verifyTicketSignature,
  generateTicketToken,
  signTicket,
} from "@/lib/ticket";
import { enqueueCheckInSync } from "@/lib/ghl-sync";

// Validação de ticket e check-in atômico (seções 2.2, 2.3 e 3.4).
// Resultados mapeados para a resposta visual do Checker:
//   checked_in  -> Verde   (Valid ticket — Check-in completed)
//   duplicate   -> Amarelo (Already checked in)
//   invalid     -> Vermelho(Invalid QR Code)
//   wrong_event -> Cinza   (Ticket belongs to another event)

export type CheckInResult = {
  result: "checked_in" | "duplicate" | "invalid" | "wrong_event";
  message: string;
  guestName?: string;
  guestTier?: string | null;
  checkedInAt?: string;
  token?: string; // para impressão de crachá on-site (#4)
  movement?: "entry" | "exit" | "reentry"; // controle de entrada/saída (#7)
  vip?: boolean; // protocolo VIP (#8)
  // D5: capacity atingida NÃO bloqueia — apenas alerta o Checker.
  capacityWarning?: boolean;
};

type ScanContext = {
  expectedEventId: string;
  checkerUserId?: string;
  deviceInfo?: string;
  ipAddress?: string;
  reentry?: boolean; // modo entrada/saída: alterna presença em vez de duplicar
};

async function log(
  eventId: string,
  status: string,
  message: string,
  ctx: ScanContext,
  refs: { guestId?: string; ticketId?: string } = {}
) {
  await prisma.checkInLog.create({
    data: {
      eventId,
      guestId: refs.guestId,
      ticketId: refs.ticketId,
      checkerUserId: ctx.checkerUserId,
      status,
      message,
      deviceInfo: ctx.deviceInfo,
      ipAddress: ctx.ipAddress,
    },
  });
}

export async function validateScan(
  token: string,
  signature: string,
  ctx: ScanContext
): Promise<CheckInResult> {
  const ticket = await prisma.ticket.findUnique({
    where: { token },
    include: { guest: true, event: true },
  });

  // Token inexistente -> Vermelho
  if (!ticket) {
    await log(ctx.expectedEventId, "invalid", "Token inexistente", ctx);
    return { result: "invalid", message: "QR Code inválido" };
  }

  // Assinatura HMAC recalculada no servidor (seção 2.4) -> Vermelho se não bater
  if (!verifyTicketSignature(ticket.eventId, ticket.guestId, token, signature)) {
    await log(ctx.expectedEventId, "invalid", "Assinatura inválida", ctx, {
      guestId: ticket.guestId,
      ticketId: ticket.id,
    });
    return { result: "invalid", message: "QR Code inválido (assinatura)" };
  }

  // Ticket de outro evento -> Cinza
  if (ticket.eventId !== ctx.expectedEventId) {
    await log(ctx.expectedEventId, "wrong_event", "Ticket de outro evento", ctx, {
      guestId: ticket.guestId,
      ticketId: ticket.id,
    });
    return {
      result: "wrong_event",
      message: "Ticket pertence a outro evento",
      guestName: ticket.guest.name,
    };
  }

  // Evento cancelado ou não-ativo -> Vermelho (ticket válido exige evento active)
  if (ticket.event.status !== "active") {
    await log(ticket.eventId, "invalid", `Evento com status ${ticket.event.status}`, ctx, {
      guestId: ticket.guestId,
      ticketId: ticket.id,
    });
    return { result: "invalid", message: "Evento não está ativo" };
  }

  // Convidado removido / ticket cancelado -> Vermelho
  if (ticket.status === "canceled" || ticket.guest.status === "canceled") {
    await log(ticket.eventId, "invalid", "Convidado removido do evento", ctx, {
      guestId: ticket.guestId,
      ticketId: ticket.id,
    });
    return { result: "invalid", message: "Convidado removido do evento" };
  }

  return performCheckIn(ticket.id, ctx);
}

// Check-in atômico: trava a linha do ticket (SELECT ... FOR UPDATE) e só marca
// checked_in se ainda não estiver — elimina a corrida de dois celulares
// escaneando o mesmo QR ao mesmo tempo (seção 3.4 / risco nº 1).
export async function performCheckIn(
  ticketId: string,
  ctx: ScanContext
): Promise<CheckInResult> {
  const outcome = await prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<
      { id: string; status: string; checked_in_at: Date | null; presence: string }[]
    >`SELECT id, status, checked_in_at, presence FROM checkin_tickets WHERE id = ${ticketId}::uuid FOR UPDATE`;
    const locked = rows[0];
    if (!locked) {
      return { result: "invalid" as const, message: "Ticket não encontrado" };
    }

    const ticket = await tx.ticket.findUniqueOrThrow({
      where: { id: ticketId },
      include: { guest: true, event: true },
    });

    // Já tem entrada registrada.
    if (locked.status === "checked_in") {
      // Modo entrada/saída (#7): alterna a presença em vez de marcar duplicado.
      if (ctx.reentry) {
        const goingOut = locked.presence === "in";
        const now = new Date();
        await tx.ticket.update({
          where: { id: ticketId },
          data: {
            presence: goingOut ? "out" : "in",
            lastScanAt: now,
            ...(goingOut ? {} : { checkinCount: { increment: 1 } }),
          },
        });
        return {
          result: "checked_in" as const,
          message: goingOut ? "Saída registrada" : "Reentrada registrada",
          movement: goingOut ? ("exit" as const) : ("reentry" as const),
          guestName: ticket.guest.name,
          guestTier: ticket.guest.tier,
          checkedInAt: locked.checked_in_at?.toISOString(),
          token: ticket.token,
          _eventId: ticket.eventId,
          _guestId: ticket.guestId,
          _logStatus: goingOut ? "exit" : "reentry",
        };
      }
      // Duplicado -> Amarelo: não altera o estado, só registra a tentativa.
      await tx.ticket.update({
        where: { id: ticketId },
        data: {
          duplicateScanCount: { increment: 1 },
          lastScanAt: new Date(),
        },
      });
      return {
        result: "duplicate" as const,
        message: "Ticket já utilizado",
        guestName: ticket.guest.name,
        guestTier: ticket.guest.tier,
        checkedInAt: locked.checked_in_at?.toISOString(),
      };
    }

    const now = new Date();
    // checked_in_by é UUID (usuário organizador); sessões de Checker por PIN
    // não têm usuário — ficam identificadas apenas no CheckInLog.
    const isUuid = ctx.checkerUserId
      ? /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(ctx.checkerUserId)
      : false;
    await tx.ticket.update({
      where: { id: ticketId },
      data: {
        status: "checked_in",
        checkedInAt: now,
        checkedInBy: isUuid ? ctx.checkerUserId : null,
        checkinCount: 1,
        presence: "in",
        lastScanAt: now,
      },
    });
    await tx.guest.update({
      where: { id: ticket.guestId },
      data: { status: "checked_in" },
    });

    // Enfileira a sincronização GHL (tag presente + custom fields + nota) sem
    // segurar a resposta do Checker — o worker processa depois (seção 3.5).
    await enqueueCheckInSync(
      tx,
      { id: ticket.guestId, eventId: ticket.eventId, ghlContactId: ticket.guest.ghlContactId },
      ticket.event.slug,
      ticket.event.name,
      now
    );

    // #8 Protocolo VIP: ao VIP entrar, avisa o anfitrião pelo canal configurado.
    if (
      ticket.guest.vip &&
      ticket.event.vipNotifyTarget &&
      ticket.event.vipNotifyChannel
    ) {
      const horas = now.toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
      });
      const text = `⭐ VIP chegou: ${ticket.guest.name} — ${ticket.event.name} às ${horas}.`;
      if (ticket.event.vipNotifyChannel === "email") {
        await tx.ghlSyncJob.create({
          data: {
            eventId: ticket.eventId,
            guestId: ticket.guestId,
            action: "send_email",
            payload: {
              to: ticket.event.vipNotifyTarget,
              subject: `VIP chegou — ${ticket.guest.name}`,
              html: text,
            },
          },
        });
      } else {
        await tx.ghlSyncJob.create({
          data: {
            eventId: ticket.eventId,
            guestId: ticket.guestId,
            action: "send_whatsapp_text",
            payload: {
              to: ticket.event.vipNotifyTarget.replace(/\D/g, ""),
              text,
            },
          },
        });
      }
    }

    // D5: alerta de capacidade — conta check-ins já incluindo este.
    let capacityWarning = false;
    if (ticket.event.capacity != null) {
      const checkedIn = await tx.ticket.count({
        where: { eventId: ticket.eventId, status: "checked_in" },
      });
      capacityWarning = checkedIn > ticket.event.capacity;
    }

    return {
      result: "checked_in" as const,
      message: "Check-in efetuado",
      movement: "entry" as const,
      guestName: ticket.guest.name,
      guestTier: ticket.guest.tier,
      checkedInAt: now.toISOString(),
      token: ticket.token,
      vip: ticket.guest.vip,
      capacityWarning,
      _eventId: ticket.eventId,
      _guestId: ticket.guestId,
    };
  });

  const { _eventId, _guestId, _logStatus, ...result } = outcome as CheckInResult & {
    _eventId?: string;
    _guestId?: string;
    _logStatus?: string;
  };

  if (_eventId) {
    await log(_eventId, _logStatus ?? result.result, result.message, ctx, {
      guestId: _guestId,
      ticketId,
    });
  } else if (result.result === "duplicate") {
    const t = await prisma.ticket.findUnique({ where: { id: ticketId } });
    if (t) {
      await log(t.eventId, "duplicate", result.message, ctx, {
        guestId: t.guestId,
        ticketId,
      });
    }
  }

  return result;
}

// Garante que o convidado tem ticket (cria se faltar) — usado no check-in por
// nome (#1) e no walk-in (#2).
export async function ensureTicket(eventId: string, guestId: string) {
  const existing = await prisma.ticket.findUnique({ where: { guestId } });
  if (existing) return existing;
  const token = generateTicketToken();
  const signature = signTicket(eventId, guestId, token);
  return prisma.ticket.create({
    data: { eventId, guestId, token, signature, status: "active" },
  });
}

// #4 Check-in do grupo inteiro a partir de um membro. Resolve os membros do
// grupo (titular + acompanhantes) e dá entrada em cada um (idempotente).
export async function checkInGroup(
  guestId: string,
  ctx: ScanContext,
): Promise<{ checkedIn: number; alreadyIn: number; total: number }> {
  const guest = await prisma.guest.findUnique({ where: { id: guestId } });
  if (!guest) return { checkedIn: 0, alreadyIn: 0, total: 0 };

  const groupKey = guest.groupId ?? guest.id;
  const members = await prisma.guest.findMany({
    where: {
      eventId: guest.eventId,
      status: { not: "canceled" },
      OR: [{ groupId: groupKey }, { id: groupKey }],
    },
  });

  let checkedIn = 0;
  let alreadyIn = 0;
  for (const m of members) {
    const ticket = await ensureTicket(m.eventId, m.id);
    const r = await performCheckIn(ticket.id, ctx);
    if (r.result === "checked_in") checkedIn++;
    else if (r.result === "duplicate") alreadyIn++;
  }
  return { checkedIn, alreadyIn, total: members.length };
}

// Desfaz um check-in (#6): reverte ticket + convidado e registra no log.
export async function undoCheckIn(
  ticketId: string,
  ctx: ScanContext,
): Promise<{ ok: boolean; message: string; guestName?: string }> {
  const outcome = await prisma.$transaction(async (tx) => {
    const ticket = await tx.ticket.findUnique({
      where: { id: ticketId },
      include: { guest: true },
    });
    if (!ticket) return { ok: false, message: "Ticket não encontrado" };
    if (ticket.status !== "checked_in") {
      return { ok: false, message: "Convidado não está com check-in" };
    }

    const hadEmail = await tx.emailLog.count({
      where: { guestId: ticket.guestId },
    });

    await tx.ticket.update({
      where: { id: ticketId },
      data: {
        status: "active",
        checkedInAt: null,
        checkedInBy: null,
        checkinCount: 0,
      },
    });
    await tx.guest.update({
      where: { id: ticket.guestId },
      data: { status: hadEmail > 0 ? "email_sent" : "qr_generated" },
    });

    return {
      ok: true,
      message: "Check-in desfeito",
      guestName: ticket.guest.name,
      eventId: ticket.eventId,
      guestId: ticket.guestId,
    };
  });

  if (outcome.ok && "eventId" in outcome && outcome.eventId) {
    await log(outcome.eventId, "undo", "Check-in desfeito", ctx, {
      guestId: outcome.guestId,
      ticketId,
    });
  }

  return {
    ok: outcome.ok,
    message: outcome.message,
    guestName: "guestName" in outcome ? outcome.guestName : undefined,
  };
}
