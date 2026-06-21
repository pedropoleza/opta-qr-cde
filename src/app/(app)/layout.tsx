import { Sparkles } from "lucide-react";
import { MainNav } from "@/components/layout/main-nav";
import { ThemeToggle } from "@/components/theme-toggle";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { supabaseConfigured } from "@/lib/supabase/config";
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
            <span className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Sparkles className="size-4" />
            </span>
            <span className="hidden sm:inline">Spark</span>
            {orgName && (
              <span className="hidden truncate text-sm font-normal text-muted-foreground md:inline">
                · {orgName}
              </span>
            )}
          </div>
          <div className="min-w-0 flex-1 overflow-x-auto">
            <MainNav />
          </div>
          <ThemeToggle />
          {supabaseConfigured() && <SignOutButton />}
        </div>
      </header>
      <main className="mx-auto w-full max-w-[1600px] flex-1 px-4 py-6 sm:px-6 sm:py-8">
        {children}
      </main>
    </div>
  );
}
