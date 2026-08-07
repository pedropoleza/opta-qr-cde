# Modal de pagamento no WordPress (Square embutido)

A modal abre a página `/checkout` deste app dentro de um **iframe**, sem
redirecionar o cliente. O pagamento roda pelo **Square Web Payments SDK**
(cartão + Google Pay + Apple Pay + Cash App Pay) e o valor vem do **evento**
(resolvido no servidor pela `agenda`) — o WordPress nunca define o preço.

## Pré-requisitos (uma vez)

No Vercel (Production), além do que já existe do Square, defina:

- `SQUARE_APPLICATION_ID` — id **público** do app (Square Developer Dashboard →
  seu app → *Application ID*; em produção começa com `sq0idp-`).
- `SQUARE_ACCESS_TOKEN`, `SQUARE_LOCATION_ID` — do **mesmo** app.
- `SQUARE_ENVIRONMENT` — `production` (ou `sandbox` para testar).

> **Apple Pay** exige verificar o domínio do site no Square (hospedar o arquivo
> de associação). Sem isso, o botão da Apple simplesmente não aparece — cartão,
> Google Pay e Cash App Pay funcionam normalmente.

## Snippet para o WordPress

Cole este bloco no tema/página onde está o formulário (ex.: um bloco *HTML
personalizado*). Ele cria a modal e uma função `optaCheckout(email, agenda)`.

```html
<!-- Modal de pagamento Opta -->
<div id="opta-modal" style="display:none;position:fixed;inset:0;z-index:99999;
     background:rgba(16,24,40,.6);align-items:center;justify-content:center;">
  <div style="position:relative;width:100%;max-width:430px;height:min(90vh,640px);">
    <button onclick="optaCloseCheckout()" aria-label="Fechar"
      style="position:absolute;top:-14px;right:-14px;z-index:1;width:34px;height:34px;
      border-radius:50%;border:0;background:#fff;box-shadow:0 2px 8px rgba(0,0,0,.2);
      font-size:18px;cursor:pointer;">×</button>
    <iframe id="opta-iframe" title="Pagamento"
      style="width:100%;height:100%;border:0;border-radius:16px;background:#fff;"
      allow="payment"></iframe>
  </div>
</div>

<script>
  // Domínio do app (ajuste se usar outro).
  var OPTA_BASE = "https://eventos.optafinance.com";

  function optaCheckout(email, agenda) {
    var url = OPTA_BASE + "/checkout?email=" + encodeURIComponent(email || "") +
              "&agenda=" + encodeURIComponent(agenda || "");
    document.getElementById("opta-iframe").src = url;
    document.getElementById("opta-modal").style.display = "flex";
    document.body.style.overflow = "hidden";
  }
  function optaCloseCheckout() {
    document.getElementById("opta-modal").style.display = "none";
    document.getElementById("opta-iframe").src = "about:blank";
    document.body.style.overflow = "";
  }
  // Quando o pagamento é confirmado, a modal avisa aqui.
  window.addEventListener("message", function (e) {
    if (e.origin !== OPTA_BASE) return;
    if (e.data && e.data.type === "opta-checkout" && e.data.status === "paid") {
      // Ex.: fechar após 2s, ou trocar por sua tela de "obrigado".
      setTimeout(optaCloseCheckout, 2500);
      // window.location.href = "/obrigado";
    }
  });
</script>
```

## Ligar ao formulário

Em vez de o formulário **redirecionar** para o Square, faça o *submit* chamar
`optaCheckout(email, agenda)` com os dados do próprio form.

**Exemplo genérico** (form com campo de e-mail e um evento fixo):

```html
<script>
  document.querySelector("#meu-form").addEventListener("submit", function (ev) {
    ev.preventDefault(); // não redireciona
    var email = this.querySelector('[name="email"]').value;
    optaCheckout(email, "Café com Elas"); // agenda = nome do evento
  });
</script>
```

- **`agenda`** deve bater com o nome do evento no painel (o casamento é
  tolerante a acento/maiúsculas). Pode passar também `&tag=<ghlTag>`.
- Se o e-mail vier de um merge field do GHL, use o mesmo valor que hoje vai no
  `/pay` (ex.: `{{contact.email}}`).

## Observações

- A nossa página `/checkout` **pode** ser embutida em iframe (nós controlamos o
  `frame-ancestors`); o checkout hospedado do Square **não** pode — por isso a
  modal usa o Web Payments SDK, não a página do Square.
- Se você restringir `CRM_FRAME_ANCESTORS`, inclua **também o domínio do site
  WordPress**, senão o iframe da modal é bloqueado.
- Ao confirmar o pagamento, o app marca o convidado como **pago** e dispara o
  **ingresso** pelo mesmo fluxo do webhook (e-mail/WhatsApp/GHL conforme o
  evento).
```
