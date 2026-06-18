# Envio do QR por e-mail via automação do HighLevel (D1 = híbrida C)

O Spark Check-in **não dispara o e-mail diretamente**. Quem envia é um workflow
nativo do HighLevel. O app é responsável apenas por preparar o contato e acionar
o gatilho. Isto exige a integração GHL conectada (Etapa 4) e o workflow montado
pelo 👤 Time.

## Fluxo

1. Organizador clica em **"Enviar QR por e-mail"** na aba QR Delivery.
2. O app (`POST /api/events/:id/send`) enfileira em `checkin_ghl_sync_jobs`:
   - `update_fields` no contato: `event_name`, `event_date`, `event_location`,
     `event_qr_link` (página `/q/{token}`), `event_qr_image` (PNG `/api/qr/{token}`),
     `event_checkin_status = qrcode_enviado`.
   - `add_tag`: **`qrcode-enviado-{slug-do-evento}`** (tag-gatilho do workflow).
   - Grava `EmailLog` (provider `ghl`, status `queued`) e move o convidado para
     `email_sent`.
3. O worker da fila (Etapa 4) executa esses jobs contra a API do GHL.
4. O **workflow do GHL** (montado pelo Time) escuta a tag `qrcode-enviado-{slug}`
   e envia o e-mail usando os custom fields do contato.

## 👤 Time — configurar no HighLevel (Etapa 4)

1. **Custom fields** (D3): `event_name`, `event_date`, `event_location`,
   `event_qr_link`, `event_qr_image`, `event_checkin_status`, `event_checked_in_at`.
2. **Workflow**:
   - Gatilho: *Contact Tag Added* = `qrcode-enviado-{slug}` (um por evento, ou um
     genérico por prefixo se a sua conta permitir).
   - Ação: *Send Email* com o template abaixo.

## Template do e-mail (referência — imagem + botão, D2)

```html
<div style="max-width:480px;margin:auto;font-family:sans-serif;text-align:center">
  <h1>{{contact.event_name}}</h1>
  <p>{{contact.event_date}} · {{contact.event_location}}</p>
  <p>Olá {{contact.first_name}}, aqui está o seu ingresso:</p>
  <img src="{{contact.event_qr_image}}" alt="QR Code" width="240" height="240" />
  <p>
    <a href="{{contact.event_qr_link}}"
       style="display:inline-block;background:#111;color:#fff;
              padding:12px 20px;border-radius:8px;text-decoration:none">
      Ver meu ingresso
    </a>
  </p>
  <p style="font-size:12px;color:#888">
    Apresente este QR Code na entrada do evento.
  </p>
</div>
```

> `event_qr_image` aponta para `/api/qr/{token}` (PNG público) e `event_qr_link`
> para `/q/{token}` (página do ingresso). Ambos usam o `APP_BASE_URL` configurado
> na Vercel, então precisam de um domínio público acessível pelo cliente de
> e-mail do convidado.
