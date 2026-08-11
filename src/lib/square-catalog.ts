import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slug";
import { listCatalogItems, type CatalogEventItem } from "@/lib/square-api";

// Sincroniza o CATÁLOGO do Square → eventos do painel. O Square é a fonte da
// verdade de nome + preço: criar/editar o item lá reflete aqui. Uso "só
// pagamento + ingresso" — o evento é criado enxuto (sem exigir data/local).

function token(): string {
  return Buffer.from(randomUUID()).toString("base64url");
}

export type SyncResult = {
  ok: boolean;
  created: number;
  updated: number;
  skipped: number; // itens sem preço no Square (ignorados)
  total: number;
  error?: string;
};

// Cria ou atualiza um evento a partir de um item do catálogo. Vínculo estável
// por squareItemId. Exportado para teste isolado.
export async function upsertEventFromCatalogItem(
  organizationId: string,
  item: CatalogEventItem,
): Promise<"created" | "updated" | "skipped"> {
  // Sem preço fixo no Square → não dá para cobrar; ignora.
  if (!item.priceCents || item.priceCents <= 0) return "skipped";

  const existing = await prisma.eventIntegration.findUnique({
    where: { squareItemId: item.itemId },
    include: { event: true },
  });

  if (existing) {
    // Atualiza o que o Square manda (nome, preço, moeda, variação).
    await prisma.$transaction([
      prisma.event.update({
        where: { id: existing.eventId },
        data: existing.event.name !== item.name ? { name: item.name } : {},
      }),
      prisma.eventIntegration.update({
        where: { id: existing.id },
        data: {
          priceCents: item.priceCents,
          currency: item.currency,
          squareVariationId: item.variationId,
        },
      }),
    ]);
    return "updated";
  }

  // Novo item → novo evento (enxuto, pagamento + ingresso).
  await prisma.event.create({
    data: {
      organizationId,
      name: item.name,
      slug: slugify(item.name) || token().slice(0, 8).toLowerCase(),
      date: new Date(), // não usado no fluxo só-pagamento; pode ser ajustado depois
      status: "active",
      checkerToken: token(),
      checkerPin: String(Math.floor(100000 + Math.random() * 900000)),
      integration: {
        create: {
          registrationToken: token(),
          paymentToken: token(),
          priceCents: item.priceCents,
          currency: item.currency,
          squareItemId: item.itemId,
          squareVariationId: item.variationId,
          autoSendQrOnPaid: true,
        },
      },
    },
  });
  return "created";
}

export async function syncSquareCatalog(
  organizationId: string,
): Promise<SyncResult> {
  let items: CatalogEventItem[];
  try {
    items = await listCatalogItems();
  } catch (err) {
    return {
      ok: false,
      created: 0,
      updated: 0,
      skipped: 0,
      total: 0,
      error: err instanceof Error ? err.message : "erro ao ler o catálogo",
    };
  }

  let created = 0,
    updated = 0,
    skipped = 0;
  for (const item of items) {
    try {
      const r = await upsertEventFromCatalogItem(organizationId, item);
      if (r === "created") created++;
      else if (r === "updated") updated++;
      else skipped++;
    } catch {
      skipped++;
    }
  }
  return { ok: true, created, updated, skipped, total: items.length };
}
