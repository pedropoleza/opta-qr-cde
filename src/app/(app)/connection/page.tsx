import { checkGhlConnection } from "@/lib/ghl";
import { ConnectionClient } from "@/components/connection/connection-client";

export const dynamic = "force-dynamic";

// Tela "Conexão do Spark" — status da integração GHL (location, token), com
// teste de conexão ao vivo. Disconnect real chega com o OAuth (Etapa 4).
export default async function ConnectionPage() {
  const status = await checkGhlConnection();
  return <ConnectionClient initialStatus={status} />;
}
