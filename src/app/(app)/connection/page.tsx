import { getCurrentOrgId } from "@/lib/api";
import { checkGhlConnection } from "@/lib/ghl";
import { ConnectionClient } from "@/components/connection/connection-client";

export const dynamic = "force-dynamic";

// Tela "Conexão do Spark" — status da integração GHL da organização, com teste
// ao vivo, conectar (token cifrado por org) e desconectar.
export default async function ConnectionPage() {
  const organizationId = await getCurrentOrgId();
  const status = await checkGhlConnection(organizationId);
  return <ConnectionClient initialStatus={status} />;
}
