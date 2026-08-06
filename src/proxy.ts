import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { SUPABASE_ANON_KEY, SUPABASE_URL, authEnabled } from "@/lib/supabase/config";
import {
  EMBED_COOKIE,
  embedGateEnabled,
  embedSecret,
  isPublicPath,
  issueEmbedToken,
  publicRedirectUrl,
  verifyEmbedToken,
} from "@/lib/embed";

// Proxy (antigo "middleware", renomeado no Next 16). Duas responsabilidades:
//   1) TRAVA DE EMBED — o painel do organizador (dashboard + APIs de gestão/
//      criação) só é acessível de dentro do CRM (que abre a URL com o segredo
//      do embed). Acesso externo direto é mandado para fora, nunca vê o painel.
//   2) SESSÃO SUPABASE (legado) — quando o login está ligado, renova a sessão e
//      protege as rotas do organizador. Hoje o login fica desligado.

export const config = {
  // Roda em páginas e APIs; pula estáticos e assets conhecidos. As rotas
  // públicas (convidado/webhooks) são liberadas dentro do proxy por isPublicPath.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sw.js|manifest.webmanifest).*)",
  ],
};

export async function proxy(req: NextRequest) {
  const { pathname, searchParams } = req.nextUrl;
  const publicPath = isPublicPath(pathname);

  // --- 1) Trava de embed (só rotas de painel; pública passa direto) ---
  if (embedGateEnabled() && !publicPath) {
    // Bootstrap: o CRM abre a URL com ?k=<segredo>. Grava o cookie de sessão
    // do embed e remove o param (302 para a mesma rota limpa).
    const k = searchParams.get("k");
    if (k && k === embedSecret()) {
      const clean = req.nextUrl.clone();
      clean.searchParams.delete("k");
      const res = NextResponse.redirect(clean);
      res.cookies.set({
        name: EMBED_COOKIE,
        value: await issueEmbedToken(),
        httpOnly: true,
        secure: true,
        // Painel exibido em iframe de OUTRO domínio (o CRM): só SameSite=None
        // é enviado nesse contexto de terceiros.
        sameSite: "none",
        path: "/",
        maxAge: 60 * 60 * 24 * 30,
      });
      return res;
    }

    // Sem sessão de embed válida → bloqueia (API: 403; página: manda pra fora).
    if (!(await verifyEmbedToken(req.cookies.get(EMBED_COOKIE)?.value))) {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json(
          { error: "Acesso restrito ao painel." },
          { status: 403 },
        );
      }
      return NextResponse.redirect(publicRedirectUrl());
    }
    // Embed válido → segue para a etapa de sessão abaixo.
  }

  // --- 2) Rotas públicas: sem sessão do organizador ---
  if (publicPath) return NextResponse.next();

  // --- 3) Sessão Supabase / proteção do organizador (legado) ---
  // Login desativado: entra direto, sem tela de /login (mantém o iframe do CRM).
  if (!authEnabled()) {
    if (pathname === "/login") {
      const to = req.nextUrl.clone();
      to.pathname = "/";
      to.search = "";
      return NextResponse.redirect(to);
    }
    return NextResponse.next();
  }

  const url = SUPABASE_URL;
  const key = SUPABASE_ANON_KEY;
  if (!url || !key) return NextResponse.next();

  let res = NextResponse.next({ request: req });
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return req.cookies.getAll();
      },
      setAll(list) {
        list.forEach(({ name, value }) => req.cookies.set(name, value));
        res = NextResponse.next({ request: req });
        list.forEach(({ name, value, options }) =>
          res.cookies.set(name, value, options),
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isOrganizer =
    pathname === "/" ||
    pathname.startsWith("/events") ||
    pathname.startsWith("/contacts") ||
    pathname.startsWith("/connection");

  if (!user && isOrganizer) {
    const to = req.nextUrl.clone();
    to.pathname = "/login";
    to.search = `?next=${encodeURIComponent(pathname)}`;
    return NextResponse.redirect(to);
  }
  if (user && pathname === "/login") {
    const to = req.nextUrl.clone();
    to.pathname = "/";
    to.search = "";
    return NextResponse.redirect(to);
  }
  return res;
}
