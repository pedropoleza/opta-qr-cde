/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// SDK do Square carregado por <script> (sem tipos oficiais); usamos `any` nas
// bordas da integração, isolado neste arquivo.

type Config = {
  applicationId: string;
  locationId: string;
  environment: "production" | "sandbox";
  amountCents: number;
  currency: string;
  eventName: string;
  buyerEmail: string | null;
};

type Props = {
  eventId: string;
  email: string;
  agenda: string;
  tag: string;
  name: string;
  phone: string;
};

type Phase = "loading" | "ready" | "paying" | "paid" | "error" | "unavailable";

function sdkUrl(env: Config["environment"]): string {
  return env === "sandbox"
    ? "https://sandbox.web.squarecdn.com/v1/square.js"
    : "https://web.squarecdn.com/v1/square.js";
}

function loadSdk(env: Config["environment"]): Promise<any> {
  const w = window as any;
  if (w.Square) return Promise.resolve(w.Square);
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = sdkUrl(env);
    s.onload = () => (w.Square ? resolve(w.Square) : reject(new Error("SDK")));
    s.onerror = () => reject(new Error("SDK"));
    document.head.appendChild(s);
  });
}

export function CheckoutClient({ eventId, email, agenda, tag, name, phone }: Props) {
  const [phase, setPhase] = useState<Phase>("loading");
  const [config, setConfig] = useState<Config | null>(null);
  const [message, setMessage] = useState<string>("");
  const [wallets, setWallets] = useState<string[]>([]);
  const cardRef = useRef<any>(null);
  const initedRef = useRef(false);

  const amountLabel = config
    ? new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: config.currency,
      }).format(config.amountCents / 100)
    : "";

  const query = new URLSearchParams({ e: eventId, email, agenda, tag, name, phone }).toString();

  // Envia o token ao backend, que recobra o valor do evento e cobra no Square.
  const submitToken = useCallback(
    async (sourceId: string, verificationToken?: string | null) => {
      setPhase("paying");
      setMessage("");
      try {
        const res = await fetch("/api/checkout/pay", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ sourceId, verificationToken, eventId, email, agenda, tag, name, phone }),
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.ok) {
          setPhase("paid");
          // Avisa o WordPress (janela pai) para fechar a modal / mostrar sucesso.
          try {
            window.parent?.postMessage(
              { type: "opta-checkout", status: "paid" },
              "*",
            );
          } catch {}
          return;
        }
        setPhase("ready");
        setMessage(traduzErro(data.error));
      } catch {
        setPhase("ready");
        setMessage("Falha de conexão. Tente novamente.");
      }
    },
    [eventId, email, agenda, tag, name, phone],
  );

  useEffect(() => {
    if (initedRef.current) return;
    initedRef.current = true;

    (async () => {
      // 1) Config do servidor (valor + IDs públicos).
      const r = await fetch(`/api/checkout/config?${query}`);
      const cfg = await r.json().catch(() => ({}));
      if (!r.ok || !cfg.ok) {
        setPhase("unavailable");
        setMessage(traduzErro(cfg.reason));
        return;
      }
      setConfig(cfg as Config);

      // 2) SDK + campos de pagamento.
      let Square: any;
      try {
        Square = await loadSdk(cfg.environment);
      } catch {
        setPhase("unavailable");
        setMessage("Não foi possível carregar o pagamento. Recarregue a página.");
        return;
      }
      const payments = Square.payments(cfg.applicationId, cfg.locationId);
      const amountStr = (cfg.amountCents / 100).toFixed(2);
      const paymentRequest = () =>
        payments.paymentRequest({
          countryCode: "US",
          currencyCode: cfg.currency,
          total: { amount: amountStr, label: cfg.eventName || "Total" },
        });

      // Cartão (sempre).
      try {
        const card = await payments.card();
        await card.attach("#opta-card");
        cardRef.current = card;
      } catch {
        setPhase("error");
        setMessage("Não foi possível iniciar o formulário de cartão.");
        return;
      }

      // Carteiras digitais — cada uma degrada em silêncio se indisponível.
      const enabled: string[] = [];
      // Google Pay
      try {
        const gp = await payments.googlePay(paymentRequest());
        await gp.attach("#opta-gpay", {
          buttonColor: "black",
          buttonType: "long",
        });
        document.getElementById("opta-gpay")?.addEventListener("click", async () => {
          const res = await gp.tokenize();
          if (res.status === "OK") submitToken(res.token);
          else setMessage("Google Pay cancelado.");
        });
        enabled.push("Google Pay");
      } catch {}
      // Apple Pay (só Safari/iOS + domínio verificado)
      try {
        const ap = await payments.applePay(paymentRequest());
        const btn = document.getElementById("opta-apple");
        if (btn) {
          btn.style.display = "block";
          btn.addEventListener("click", async () => {
            const res = await ap.tokenize();
            if (res.status === "OK") submitToken(res.token);
            else setMessage("Apple Pay cancelado.");
          });
          enabled.push("Apple Pay");
        }
      } catch {}
      // Cash App Pay
      try {
        const cap = await payments.cashAppPay(paymentRequest(), {
          redirectURL: window.location.href,
          referenceId: `co-${Date.now()}`,
        });
        await cap.attach("#opta-cashapp");
        cap.addEventListener("ontokenization", (e: any) => {
          const t = e?.detail?.tokenResult;
          if (t?.status === "OK") submitToken(t.token);
        });
        enabled.push("Cash App Pay");
      } catch {}

      setWallets(enabled);
      setPhase("ready");
    })();
  }, [query, submitToken]);

  // Pagamento com cartão.
  const payWithCard = useCallback(async () => {
    const card = cardRef.current;
    if (!card || !config) return;
    setPhase("paying");
    setMessage("");
    try {
      const result = await card.tokenize();
      if (result.status !== "OK") {
        setPhase("ready");
        setMessage("Verifique os dados do cartão.");
        return;
      }
      // SCA (3-D Secure) quando o emissor exigir.
      let verificationToken: string | undefined;
      try {
        const w = window as any;
        const payments = w.Square.payments(config.applicationId, config.locationId);
        const v = await payments.verifyBuyer(result.token, {
          amount: (config.amountCents / 100).toFixed(2),
          currencyCode: config.currency,
          intent: "CHARGE",
          billingContact: config.buyerEmail ? { email: config.buyerEmail } : {},
        });
        verificationToken = v?.token;
      } catch {
        /* segue sem 3DS se o passo falhar/não for exigido */
      }
      await submitToken(result.token, verificationToken);
    } catch {
      setPhase("ready");
      setMessage("Não foi possível processar. Tente novamente.");
    }
  }, [config, submitToken]);

  return (
    <div className="opta-wrap">
      <style>{CSS}</style>
      <div className="opta-card">
        {phase === "paid" ? (
          <div className="opta-done">
            <div className="opta-check">✓</div>
            <h2>Pagamento confirmado</h2>
            <p>Seu ingresso está a caminho por e-mail.</p>
          </div>
        ) : (
          <>
            <header className="opta-head">
              <p className="opta-evt">{config?.eventName || "Pagamento"}</p>
              {amountLabel && <p className="opta-amt">{amountLabel}</p>}
            </header>

            {phase === "unavailable" ? (
              <p className="opta-msg opta-err">{message || "Pagamento indisponível."}</p>
            ) : (
              <>
                {wallets.length > 0 && (
                  <div className="opta-wallets">
                    <button id="opta-apple" className="opta-apple" style={{ display: "none" }} />
                    <div id="opta-gpay" className="opta-gpay" />
                    <div id="opta-cashapp" />
                    <div className="opta-or"><span>ou pague com cartão</span></div>
                  </div>
                )}

                <div id="opta-card" className="opta-field" />

                {message && <p className="opta-msg opta-err">{message}</p>}

                <button
                  className="opta-pay"
                  onClick={payWithCard}
                  disabled={phase === "loading" || phase === "paying"}
                >
                  {phase === "paying"
                    ? "Processando…"
                    : phase === "loading"
                      ? "Carregando…"
                      : `Pagar ${amountLabel}`}
                </button>
                <p className="opta-secure">🔒 Pagamento seguro processado pelo Square</p>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function traduzErro(reason?: string): string {
  switch (reason) {
    case "event":
      return "Não encontramos o evento para esse pagamento.";
    case "price":
      return "Este evento ainda não tem valor de inscrição configurado.";
    case "guest":
      return "Informe um e-mail válido para continuar.";
    case "unconfigured":
      return "Pagamento indisponível no momento.";
    case "not_completed":
      return "O pagamento não foi concluído. Tente outro método.";
    case "org":
      return "Configuração de pagamento ausente.";
    default:
      return reason ? "Não foi possível concluir o pagamento." : "";
  }
}

const CSS = `
.opta-wrap{min-height:100vh;display:flex;align-items:center;justify-content:center;background:#f4f5f7;padding:16px;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#101828}
.opta-card{width:100%;max-width:400px;background:#fff;border-radius:16px;box-shadow:0 10px 40px rgba(16,24,40,.12);padding:22px}
.opta-head{text-align:center;margin-bottom:16px}
.opta-evt{font-size:14px;color:#667085;margin:0}
.opta-amt{font-size:30px;font-weight:700;margin:4px 0 0}
.opta-wallets{display:flex;flex-direction:column;gap:10px;margin-bottom:6px}
.opta-gpay,.opta-apple{min-height:44px;border-radius:8px;overflow:hidden}
.opta-apple{-webkit-appearance:-apple-pay-button;-apple-pay-button-type:plain;-apple-pay-button-style:black;height:44px;border:0;width:100%}
.opta-or{display:flex;align-items:center;text-align:center;color:#98a2b3;font-size:12px;margin:8px 0}
.opta-or::before,.opta-or::after{content:"";flex:1;border-bottom:1px solid #eaecf0}
.opta-or span{padding:0 10px}
.opta-field{margin:6px 0 14px;min-height:52px}
.opta-pay{width:100%;background:#101828;color:#fff;border:0;border-radius:10px;padding:14px;font-size:16px;font-weight:600;cursor:pointer}
.opta-pay:disabled{opacity:.6;cursor:default}
.opta-secure{text-align:center;color:#98a2b3;font-size:12px;margin:10px 0 0}
.opta-msg{font-size:14px;margin:4px 0 10px;text-align:center}
.opta-err{color:#d92d20}
.opta-done{text-align:center;padding:24px 8px}
.opta-check{width:56px;height:56px;border-radius:50%;background:#12b76a;color:#fff;font-size:30px;display:flex;align-items:center;justify-content:center;margin:0 auto 14px}
.opta-done h2{margin:0 0 6px;font-size:20px}
.opta-done p{margin:0;color:#667085}
@media (prefers-color-scheme: dark){
 .opta-wrap{background:#0b0d12;color:#e7e9ee}
 .opta-card{background:#15171c;box-shadow:0 10px 40px rgba(0,0,0,.5)}
 .opta-amt{color:#fff}
 .opta-pay{background:#fff;color:#101828}
 .opta-field{background:#fff;border-radius:8px;padding:2px}
}
`;
