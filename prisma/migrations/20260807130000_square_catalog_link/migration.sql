-- Vínculo do evento com o item do catálogo do Square (fonte da verdade do
-- nome/preço). Colunas opcionais; eventos existentes não são afetados.
ALTER TABLE "checkin_event_integrations" ADD COLUMN "square_item_id" TEXT;
ALTER TABLE "checkin_event_integrations" ADD COLUMN "square_variation_id" TEXT;

CREATE UNIQUE INDEX "checkin_event_integrations_square_item_id_key"
  ON "checkin_event_integrations" ("square_item_id");
