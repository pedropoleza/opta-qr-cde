import { MainNav } from "@/components/layout/main-nav";
import { ThemeToggle } from "@/components/theme-toggle";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { authEnabled } from "@/lib/supabase/config";
import { getCurrentOrg } from "@/lib/api";

// Navegação por abas superiores (sem sidebar). White-label "Spark" + nome da
// organização do tenant.
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let orgName = "";
  try {
    orgName = (await getCurrentOrg()).name;
  } catch {
    /* sem sessão (não deveria ocorrer em rota protegida) */
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-30 border-b bg-card/80 backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <div className="mx-auto flex h-14 w-full max-w-[1600px] items-center gap-3 px-4 sm:gap-4 sm:px-6">
          <div className="flex shrink-0 items-center gap-2 font-semibold">
            {/* Logo da Opta — variante por tema (escura no claro, branca no escuro) */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/opta-finance-logo.png"
              alt={orgName || "Opta Finance"}
              className="h-6 w-auto object-contain dark:hidden"
            />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/opta-finance-logo-white.png"
              alt={orgName || "Opta Finance"}
              className="hidden h-6 w-auto object-contain dark:block"
            />
          </div>
          <div className="min-w-0 flex-1 overflow-x-auto">
            <MainNav />
          </div>
          <ThemeToggle />
          {authEnabled() && <SignOutButton />}
        </div>
      </header>
      <main className="mx-auto w-full max-w-[1600px] flex-1 px-4 pt-6 pb-32 sm:px-6 sm:pt-8 sm:pb-40">
        {children}
      </main>
      {/* Rodapé estendido: respiro extra ao rolar até o fim dentro do iframe do CRM. */}
      <div aria-hidden className="h-16 shrink-0" />
    </div>
  );
}
