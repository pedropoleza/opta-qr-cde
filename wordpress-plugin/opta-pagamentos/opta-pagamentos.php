<?php
/**
 * Plugin Name:       Opta Pagamentos
 * Description:        Botão que abre o checkout do Square numa modal (sem redirecionar). Use o shortcode [opta_pagar evento="ID_DO_EVENTO"].
 * Version:           1.0.0
 * Author:            Opta Finance
 * License:           GPL-2.0-or-later
 * Requires at least: 5.0
 * Requires PHP:      7.2
 */

if (!defined('ABSPATH')) {
    exit; // acesso direto bloqueado
}

/**
 * Domínio do app Opta (onde roda /checkout). Para trocar sem editar o plugin,
 * defina no wp-config.php:  define('OPTA_CHECKOUT_BASE', 'https://seu-dominio');
 * ou use o filtro 'opta_checkout_base'.
 */
function opta_checkout_base() {
    $base = defined('OPTA_CHECKOUT_BASE') ? OPTA_CHECKOUT_BASE : 'https://eventos.optafinance.com';
    return rtrim(apply_filters('opta_checkout_base', $base), '/');
}

/**
 * Shortcode:  [opta_pagar evento="ID" texto="Pagar inscrição" email="#seu-campo"]
 *  - evento (obrigatório): id do evento (o painel mostra pronto).
 *  - texto  (opcional): rótulo do botão.
 *  - email  (opcional): seletor CSS do campo de e-mail; padrão = primeiro input[type=email].
 */
function opta_pagar_shortcode($atts) {
    $a = shortcode_atts(array(
        'evento' => '',
        'texto'  => 'Pagar inscrição',
        'email'  => '',
        'classe' => 'opta-pay-btn',
    ), $atts, 'opta_pagar');

    if (empty($a['evento'])) {
        return '<!-- [opta_pagar]: informe o atributo evento="ID_DO_EVENTO" -->';
    }

    opta_enqueue_modal();

    $base       = opta_checkout_base();
    $url        = $base . '/checkout?e=' . rawurlencode($a['evento']);
    $email_attr = $a['email'] !== '' ? ' data-opta-email="' . esc_attr($a['email']) . '"' : '';

    return sprintf(
        '<button type="button" class="%s" data-opta-checkout="%s"%s>%s</button>',
        esc_attr($a['classe']),
        esc_attr($url),
        $email_attr,
        esc_html($a['texto'])
    );
}
add_shortcode('opta_pagar', 'opta_pagar_shortcode');

/**
 * Garante que a modal + script sejam impressos uma única vez no rodapé.
 */
function opta_enqueue_modal() {
    static $done = false;
    if ($done) {
        return;
    }
    $done = true;
    add_action('wp_footer', 'opta_render_modal', 99);
}

function opta_render_modal() {
    $base = esc_js(opta_checkout_base());
    ?>
<!-- Opta Pagamentos: modal -->
<style>
  .opta-pay-btn{display:inline-block;background:#101828;color:#fff;border:0;border-radius:10px;
    padding:13px 20px;font-size:16px;font-weight:600;cursor:pointer;font-family:inherit}
  .opta-pay-btn:hover{filter:brightness(1.08)}
  #opta-modal{display:none;position:fixed;inset:0;z-index:99999;background:rgba(16,24,40,.6);
    align-items:center;justify-content:center;padding:16px}
  #opta-modal.opta-open{display:flex}
  #opta-modal .opta-box{position:relative;width:100%;max-width:430px;height:min(90vh,640px)}
  #opta-modal .opta-x{position:absolute;top:-14px;right:-14px;z-index:1;width:34px;height:34px;
    border-radius:50%;border:0;background:#fff;box-shadow:0 2px 8px rgba(0,0,0,.2);font-size:18px;cursor:pointer}
  #opta-modal iframe{width:100%;height:100%;border:0;border-radius:16px;background:#fff}
</style>
<div id="opta-modal" aria-hidden="true">
  <div class="opta-box">
    <button type="button" class="opta-x" aria-label="Fechar" onclick="optaCloseCheckout()">&times;</button>
    <iframe id="opta-iframe" title="Pagamento" allow="payment"></iframe>
  </div>
</div>
<script>
(function () {
  var BASE = "<?php echo $base; ?>";
  function emailFor(trigger) {
    var sel = trigger.getAttribute("data-opta-email");
    var el = sel ? document.querySelector(sel) : document.querySelector('input[type="email"]');
    return el && el.value ? el.value : "";
  }
  function open(url, trigger) {
    var full = url + (url.indexOf("?") > -1 ? "&" : "?") + "email=" + encodeURIComponent(emailFor(trigger));
    document.getElementById("opta-iframe").src = full;
    document.getElementById("opta-modal").classList.add("opta-open");
    document.body.style.overflow = "hidden";
  }
  window.optaCloseCheckout = function () {
    document.getElementById("opta-modal").classList.remove("opta-open");
    document.getElementById("opta-iframe").src = "about:blank";
    document.body.style.overflow = "";
  };
  document.addEventListener("click", function (e) {
    var t = e.target.closest("[data-opta-checkout]");
    if (!t) return;
    e.preventDefault();
    open(t.getAttribute("data-opta-checkout"), t);
  });
  window.addEventListener("message", function (e) {
    if (e.origin !== BASE) return;
    if (e.data && e.data.type === "opta-checkout" && e.data.status === "paid") {
      setTimeout(window.optaCloseCheckout, 2500);
    }
  });
})();
</script>
<?php
}
