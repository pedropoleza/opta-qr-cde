import { NextResponse } from "next/server";
import { checkGhlConnection } from "@/lib/ghl";

export const dynamic = "force-dynamic";

// Status da conexão com o Spark/GHL (usado pelo botão "Testar conexão").
export async function GET() {
  const status = await checkGhlConnection();
  return NextResponse.json(status);
}
