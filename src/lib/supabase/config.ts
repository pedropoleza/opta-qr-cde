// Liga o multi-tenant (Supabase Auth). As chaves são PÚBLICAS por design (a
// anon key só autentica login; os dados são protegidos por escopo de org no
// app). Embutidas como padrão para a Fase 1 ficar ligada sem depender de env;
// ainda podem ser sobrescritas por env var.
export const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  "https://mumdhdiliejulkblwhuw.supabase.co";

export const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im11bWRoZGlsaWVqdWxrYmx3aHV3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwNzU5NzcsImV4cCI6MjA5MzY1MTk3N30.rNrFGsDD5FXHRwFiUx2Sh5CxMl7XiBdETrdZWj-VinM";

export function supabaseConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}
