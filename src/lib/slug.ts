// Slug do evento usado como sufixo das tags de rastreamento no GHL
// (seção 3.5): minúsculo, sem acentos, espaços por hífen.
// Ex.: "Brazillionaires 2026" -> "brazillionaires-2026"
export function slugify(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
