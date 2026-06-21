"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Sparkles } from "lucide-react";
import { createSupabaseBrowser } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LoginForm() {
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const next = useSearchParams().get("next") || "/";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setMsg("");
    const supabase = createSupabaseBrowser();
    if (mode === "in") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError(error.message);
      else {
        window.location.href = next;
        return;
      }
    } else {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) setError(error.message);
      else if (data.session) {
        window.location.href = next;
        return;
      } else {
        setMsg("Conta criada. Confirme pelo e-mail e depois entre.");
        setMode("in");
      }
    }
    setBusy(false);
  }

  return (
    <div className="w-full max-w-sm space-y-6">
      <div className="flex flex-col items-center gap-2 text-center">
        <span className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <Sparkles className="size-5" />
        </span>
        <h1 className="text-xl font-bold">Spark Check-in</h1>
        <p className="text-sm text-muted-foreground">
          {mode === "in" ? "Entre na sua conta" : "Crie sua organização"}
        </p>
      </div>

      <form onSubmit={submit} className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="email">E-mail</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Senha</Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            autoComplete={mode === "in" ? "current-password" : "new-password"}
          />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        {msg && <p className="text-sm text-success">{msg}</p>}
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? "..." : mode === "in" ? "Entrar" : "Criar conta"}
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        {mode === "in" ? "Não tem conta?" : "Já tem conta?"}{" "}
        <button
          type="button"
          className="font-medium text-primary hover:underline"
          onClick={() => {
            setMode((m) => (m === "in" ? "up" : "in"));
            setError("");
            setMsg("");
          }}
        >
          {mode === "in" ? "Criar organização" : "Entrar"}
        </button>
      </p>
    </div>
  );
}
