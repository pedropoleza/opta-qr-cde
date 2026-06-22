import { redirect } from "next/navigation";
import { Suspense } from "react";
import { authEnabled } from "@/lib/supabase/config";
import { LoginForm } from "@/components/auth/login-form";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  // Login desativado → não há tela de login; volta para o app.
  if (!authEnabled()) redirect("/");
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <Suspense>
        <LoginForm />
      </Suspense>
    </div>
  );
}
