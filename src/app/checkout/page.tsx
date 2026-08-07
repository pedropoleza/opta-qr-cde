import { Suspense } from "react";
import { CheckoutClient } from "./checkout-client";

export const dynamic = "force-dynamic";

// Página pública da modal de pagamento. O WordPress abre esta URL num iframe
// (modal), passando o e-mail e a agenda do formulário:
//   /checkout?email={{email}}&agenda=<evento>
// O valor NÃO vem na URL — é resolvido no servidor pelo evento.
export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const str = (v: string | string[] | undefined) =>
    typeof v === "string" ? v : Array.isArray(v) ? v[0] ?? "" : "";

  return (
    <Suspense>
      <CheckoutClient
        email={str(sp.email)}
        agenda={str(sp.agenda)}
        tag={str(sp.tag)}
        name={str(sp.name)}
        phone={str(sp.phone)}
      />
    </Suspense>
  );
}
