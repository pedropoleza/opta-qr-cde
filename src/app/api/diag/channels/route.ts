import { NextResponse } from "next/server";
import { cleanEnv } from "@/lib/ghl";
import { getStevoConfig } from "@/lib/stevo";

export const dynamic = "force-dynamic";

// Diagnóstico de configuração de canais (mascarado — nunca revela segredos).
// Ajuda a conferir se as env vars do Vercel batem com o esperado, sem expor
// as chaves. Mostra só presença, tamanho e os últimos 4 caracteres.
function mask(v: string): { set: boolean; len: number; last4: string } {
  return { set: Boolean(v), len: v.length, last4: v ? v.slice(-4) : "" };
}

export async function GET() {
  // Config EFETIVA (banco → env → fallback fixo), que é a que o envio usa.
  const stevo = await getStevoConfig().catch(() => ({ base: "", apikey: "" }));
  const stevoEnvUrl = cleanEnv(process.env.STEVO_API_URL);
  const stevoEnvKey = cleanEnv(process.env.STEVO_API_KEY);
  return NextResponse.json({
    stevo: {
      url: stevo.base || null, // a URL não é segredo — ajuda a conferir a instância
      key: mask(stevo.apikey),
      configured: Boolean(stevo.base && stevo.apikey),
      env_only: { url: stevoEnvUrl || null, key: mask(stevoEnvKey) },
    },
    square: {
      token: mask(cleanEnv(process.env.SQUARE_ACCESS_TOKEN)),
      locationId: cleanEnv(process.env.SQUARE_LOCATION_ID) || null,
      environment: cleanEnv(process.env.SQUARE_ENVIRONMENT) || null,
      signatureKey: mask(cleanEnv(process.env.SQUARE_WEBHOOK_SIGNATURE_KEY)),
    },
    email: {
      resendKey: mask(cleanEnv(process.env.RESEND_API_KEY)),
      from: cleanEnv(process.env.EMAIL_FROM) || null,
    },
  });
}
