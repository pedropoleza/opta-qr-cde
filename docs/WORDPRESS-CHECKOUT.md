# Modal de pagamento no WordPress (Square embutido)

A modal abre a página `/checkout` deste app dentro de um **iframe**, sem
redirecionar o cliente. O pagamento roda pelo **Square Web Payments SDK**
(cartão + Google Pay + Apple Pay + Cash App Pay) e o valor vem do **evento**
(resolvido no servidor) — o WordPress nunca define o preço.

O código do site é **genérico**: você cola **uma vez**. Cada evento é
identificado pelo próprio link (`/checkout?e=<id do evento>`), que o painel
gera pronto — **nada é chumbado por evento**.

> **Jeito mais simples (recomendado): plugin de WordPress.** Em
> `wordpress-plugin/opta-pagamentos/` tem um plugin. Instala uma vez e, por
> evento, o operador cola só uma linha: `[opta_pagar evento="ID_DO_EVENTO"]`
> (o painel mostra pronta, em *Evento → Pagamentos*). Quem prefere sem plugin
> segue as seções abaixo (script + botão HTML).

## O Square é a fonte da verdade (nome + preço)

Você **cria o item no Square** (Catálogo → Item, com nome e preço) e no painel
clica em **"Sincronizar do Square"** (topo da tela Eventos). O app lê o catálogo
e cria/atualiza os eventos com **nome e preço vindos do Square** — você não
digita preço no painel. Mudou o preço no Square? Sincronize de novo e atualiza.

- Criar um item no Square: **Square Dashboard → Itens/Catálogo → Criar item**,
  com um preço fixo.
- Itens sem preço fixo são ignorados na sincronização.
- Fluxo "só pagamento + ingresso": o evento é criado enxuto (o Square não guarda
  data/local). Se um dia usar check-in, é só completar a data no painel.

## 1. Pré-requisitos (uma vez, no Vercel)

Além do que já existe do Square, defina em Production:

- `SQUARE_APPLICATION_ID` — id **público** do app (Square Developer Dashboard →
  seu app → *Application ID*; em produção começa com `sq0idp-`).
- `SQUARE_ACCESS_TOKEN`, `SQUARE_LOCATION_ID` — do **mesmo** app.
- `SQUARE_ENVIRONMENT` — `production` (ou `sandbox` para testar).

> **Apple Pay** exige verificar o domínio do site no Square. Sem isso, só o botão
> da Apple não aparece — cartão, Google Pay e Cash App Pay funcionam normal.

## 2. O script da modal (colar UMA vez no site)

Cole este bloco no rodapé do tema (ou num bloco *HTML* global). Ele cria a modal
e liga **automaticamente** qualquer botão com o atributo `data-opta-checkout`.

```html
<!-- Modal de pagamento Opta — colar uma vez -->
<div id="opta-modal" style="display:none;position:fixed;inset:0;z-index:99999;
     background:rgba(16,24,40,.6);align-items:center;justify-content:center;">
  <div style="position:relative;width:100%;max-width:430px;height:min(90vh,640px);">
    <button onclick="optaCloseCheckout()" aria-label="Fechar"
      style="position:absolute;top:-14px;right:-14px;z-index:1;width:34px;height:34px;
      border-radius:50%;border:0;background:#fff;box-shadow:0 2px 8px rgba(0,0,0,.2);
      font-size:18px;cursor:pointer;">×</button>
    <iframe id="opta-iframe" title="Pagamento" allow="payment"
      style="width:100%;height:100%;border:0;border-radius:16px;background:#fff;"></iframe>
  </div>
</div>

<script>
(function () {
  // Abre qualquer botão/link com data-opta-checkout="<link do evento>".
  // O e-mail é lido do formulário: por padrão o primeiro <input type="email">,
  // ou o seletor passado em data-opta-email (ex.: data-opta-email="#campo-email").
  function getEmail(trigger) {
    var sel = trigger.getAttribute("data-opta-email");
    var el = sel ? document.querySelector(sel) : document.querySelector('input[type="email"]');
    return el && el.value ? el.value : "";
  }
  function optaOpen(url, trigger) {
    var email = getEmail(trigger);
    var full = url + (url.indexOf("?") > -1 ? "&" : "?") +
               "email=" + encodeURIComponent(email);
    document.getElementById("opta-iframe").src = full;
    document.getElementById("opta-modal").style.display = "flex";
    document.body.style.overflow = "hidden";
  }
  window.optaCloseCheckout = function () {
    document.getElementById("opta-modal").style.display = "none";
    document.getElementById("opta-iframe").src = "about:blank";
    document.body.style.overflow = "";
  };
  document.addEventListener("click", function (e) {
    var t = e.target.closest("[data-opta-checkout]");
    if (!t) return;
    e.preventDefault();
    optaOpen(t.getAttribute("data-opta-checkout"), t);
  });
  window.addEventListener("message", function (e) {
    if (e.origin !== "https://eventos.optafinance.com") return;
    if (e.data && e.data.type === "opta-checkout" && e.data.status === "paid") {
      setTimeout(window.optaCloseCheckout, 2500);
      // Opcional: window.location.href = "/obrigado";
    }
  });
})();
</script>
```

## 3. O botão de cada evento (o painel te dá pronto)

No painel: **abra o evento → aba Pagamentos → "Pagamento no site (modal)"** e
copie o **Botão para o site**. Ele já vem com o link do evento, por exemplo:

```html
<button data-opta-checkout="https://eventos.optafinance.com/checkout?e=EVENTO_ID">
  Pagar inscrição
</button>
```

Cole esse botão na página/formulário daquele evento. Para um evento novo, repita:
crie o evento, defina o preço, copie o botão dele. **O script da seção 2 nunca
muda.**

### Ligar a um formulário existente

Se o formulário tem um botão próprio de "enviar", basta acrescentar o atributo
nele (e o seletor do campo de e-mail, se não for um `type="email"`):

```html
<button type="submit"
        data-opta-checkout="https://eventos.optafinance.com/checkout?e=EVENTO_ID"
        data-opta-email="#email">Inscrever e pagar</button>
```

## Observações

- **Nada é chumbado por evento:** o único dado específico é o link
  `/checkout?e=<id>`, que o painel gera. Preço, nome e moeda saem do evento no
  servidor — o navegador nunca define o valor.
- A nossa página `/checkout` **pode** ir em iframe (controlamos o
  `frame-ancestors`); o checkout hospedado do Square **não** pode — por isso a
  modal usa o Web Payments SDK, não a página do Square.
- Se você restringir `CRM_FRAME_ANCESTORS`, inclua **também o domínio do site
  WordPress**, senão o iframe da modal é bloqueado.
- Ao confirmar o pagamento, o app marca o convidado como **pago** e dispara o
  **ingresso** pelo mesmo fluxo do webhook (e-mail/WhatsApp/GHL conforme o
  evento).
