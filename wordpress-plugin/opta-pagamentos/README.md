# Opta Pagamentos — plugin de WordPress

Abre o checkout do Square numa **modal** no site (sem redirecionar). Você usa um
**shortcode por evento**; o resto (modal, e-mail, fechar ao pagar) o plugin faz.

## Instalar

1. Zipe a pasta `opta-pagamentos` (deve conter `opta-pagamentos.php`).
2. No WordPress: **Plugins → Adicionar novo → Enviar plugin** → escolha o zip →
   **Instalar** → **Ativar**.

## Usar (por evento)

Na página do evento, cole o shortcode com o **id do evento** (o painel Opta
mostra pronto em *Evento → Pagamentos*):

```
[opta_pagar evento="ID_DO_EVENTO"]
```

Opcionais:

```
[opta_pagar evento="ID_DO_EVENTO" texto="Inscrever e pagar" email="#seu-campo-email"]
```

- `texto` — rótulo do botão (padrão: "Pagar inscrição").
- `email` — seletor CSS do campo de e-mail. Por padrão o plugin usa o primeiro
  `input[type="email"]` da página.

O valor cobrado é **o preço do evento** (vindo do Square) — não vai na página.

## Trocar o domínio do app (opcional)

Por padrão aponta para `https://eventos.optafinance.com`. Para mudar, no
`wp-config.php`:

```php
define('OPTA_CHECKOUT_BASE', 'https://seu-dominio.com');
```

## Observações

- Se o tema tiver uma CSP restritiva, permita o iframe de
  `eventos.optafinance.com`. Do lado do app, o domínio do site precisa estar em
  `CRM_FRAME_ANCESTORS` (se essa variável estiver definida).
- **Apple Pay** exige verificar o domínio no Square; sem isso só o botão da
  Apple não aparece.
