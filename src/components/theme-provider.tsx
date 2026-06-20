"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ComponentProps } from "react";

// Provider de tema (next-themes) — alterna a classe `.dark` no <html>, que
// dirige os tokens light/dark já definidos em globals.css. App roda embutido
// como iframe no CRM, então o tema é controlado aqui (não há login).
export function ThemeProvider({
  children,
  ...props
}: ComponentProps<typeof NextThemesProvider>) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
