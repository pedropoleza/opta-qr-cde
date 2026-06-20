import { prisma } from "@/lib/prisma";
import {
  type TicketConfig,
  resolveTicketConfig,
} from "@/lib/ticket-template";

// Resolve o modelo do ingresso para um evento: override do evento → padrão da
// organização → default do sistema.
export async function getEventTicketConfig(
  eventId: string,
): Promise<{ config: TicketConfig; scope: "event" | "org" | "default" }> {
  const override = await prisma.ticketTemplate.findUnique({
    where: { eventId },
  });
  if (override) {
    return {
      config: resolveTicketConfig(override.config as Partial<TicketConfig>),
      scope: "event",
    };
  }

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { organizationId: true },
  });
  if (event) {
    const orgDefault = await prisma.ticketTemplate.findFirst({
      where: { organizationId: event.organizationId, eventId: null },
    });
    if (orgDefault) {
      return {
        config: resolveTicketConfig(orgDefault.config as Partial<TicketConfig>),
        scope: "org",
      };
    }
  }

  return { config: resolveTicketConfig(null), scope: "default" };
}

// Salva o modelo como padrão da organização (scope=org) ou override do evento.
export async function saveTicketTemplate(
  organizationId: string,
  eventId: string | null,
  config: TicketConfig,
) {
  if (eventId) {
    await prisma.ticketTemplate.upsert({
      where: { eventId },
      create: { organizationId, eventId, config },
      update: { config },
    });
    return;
  }
  const existing = await prisma.ticketTemplate.findFirst({
    where: { organizationId, eventId: null },
  });
  if (existing) {
    await prisma.ticketTemplate.update({
      where: { id: existing.id },
      data: { config },
    });
  } else {
    await prisma.ticketTemplate.create({
      data: { organizationId, eventId: null, config },
    });
  }
}
