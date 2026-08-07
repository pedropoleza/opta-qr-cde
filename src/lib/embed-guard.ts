import { cookies } from "next/headers";
import { EMBED_COOKIE, embedGateEnabled, verifyEmbedToken } from "@/lib/embed";

// Guard server-side (defesa em profundidade, além do proxy) para os handlers
// de escrita mais sensíveis — ex.: criação de eventos/projetos. Fica em arquivo
// separado porque usa `next/headers`, que não pode ser importado pelo proxy.
// Com a trava desligada (sem ADMIN_EMBED_SECRET), libera — não muda o
// comportamento atual até o segredo ser configurado.
export async function isEmbedded(): Promise<boolean> {
  if (!embedGateEnabled()) return true;
  const store = await cookies();
  return verifyEmbedToken(store.get(EMBED_COOKIE)?.value);
}
