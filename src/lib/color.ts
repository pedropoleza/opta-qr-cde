// Utilidades de cor para contraste automático (F4): escolhe texto claro/escuro
// conforme a luminância da cor de fundo da marca.

function parseHex(hex: string): { r: number; g: number; b: number } | null {
  const v = hex.trim().replace(/^#/, "");
  const full = v.length === 3 ? v.split("").map((c) => c + c).join("") : v;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return null;
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  };
}

// Luminância relativa (0–1) — fórmula WCAG simplificada.
export function luminance(hex: string): number {
  const c = parseHex(hex);
  if (!c) return 0;
  const f = (x: number) => {
    const s = x / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
}

export function isLightColor(hex: string): boolean {
  return luminance(hex) > 0.55;
}

// Cor de texto legível sobre `bg`.
export function readableOn(bg: string, dark = "#101828", light = "#FFFFFF"): string {
  return isLightColor(bg) ? dark : light;
}

// Clareia (percent > 0) ou escurece (percent < 0) um hex. Usado para gerar o
// gradiente do hero do e-mail a partir da cor da marca.
export function shade(hex: string, percent: number): string {
  const c = parseHex(hex);
  if (!c) return hex;
  const t = percent < 0 ? 0 : 255;
  const p = Math.abs(percent) / 100;
  const mix = (x: number) => Math.round((t - x) * p + x);
  const h = (x: number) => mix(x).toString(16).padStart(2, "0");
  return `#${h(c.r)}${h(c.g)}${h(c.b)}`;
}
