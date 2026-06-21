// Liga/desliga o multi-tenant (Supabase Auth) por env. Sem as chaves, o app
// opera em modo single-tenant (sem login) — não quebra a operação atual.
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export function supabaseConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}
