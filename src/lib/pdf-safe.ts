// Remove caracteres que a fonte padrão do PDF (Helvetica) não renderiza —
// emojis, pictogramas e símbolos (ex.: 📍 vira lixo "≡"/"=Í" antes do texto).
export function pdfText(s?: string | null): string {
  if (!s) return "";
  return s
    .replace(
      /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{2300}-\u{23FF}\u{25A0}-\u{25FF}\u{2B00}-\u{2BFF}\u{1F1E6}-\u{1F1FF}\u{FE00}-\u{FE0F}\u{200D}]/gu,
      "",
    )
    .replace(/\s{2,}/g, " ")
    .trim();
}
