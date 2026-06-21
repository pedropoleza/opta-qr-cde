"use client";

import { LogOut } from "lucide-react";
import { createSupabaseBrowser } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

export function SignOutButton() {
  async function signOut() {
    await createSupabaseBrowser().auth.signOut();
    window.location.href = "/login";
  }
  return (
    <Button variant="ghost" size="icon" aria-label="Sair" onClick={signOut}>
      <LogOut />
    </Button>
  );
}
