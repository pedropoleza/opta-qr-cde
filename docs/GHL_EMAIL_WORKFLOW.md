# Envio do QR por e-mail via workflow do Spark/GHL (por cliente)

No modelo "workflow", **quem compõe e envia o e-mail é o workflow dentro do GHL
de cada cliente** — não o app. Isso torna o e-mail **variável por cliente por
natureza** (cada subaccount tem seu próprio template, remetente, design e idioma).
O app só (1) grava variáveis no contato e (2) aciona a tag-gatilho.

## Como a personalização por cliente funciona
- Cada cliente monta **um workflow** no próprio GHL, disparado pela tag
  `qrcode-enviado-{slug-do-evento}`.
- O e-mail do workflow usa as **variáveis (custom fields)** que o app grava no
  contato. Assim o conteúdo é 100% editável por cliente — e até por evento
  (a tag tem o slug do evento, então dá para ramificar por evento).

## Variáveis disponíveis (custom fields gravados pelo app)
Crie estes campos na location (Settings → Custom Fields) com a **chave** exata:

| Campo (key) | Conteúdo |
|---|---|
| `guest_name` | Nome do convidado |
| `event_name` | Nome do evento |
| `event_date` | Data (YYYY-MM-DD) |
| `event_time` | Horário de início |
| `event_location` | Local |
| `event_address` | Endereço |
| `event_qr_link` | Página do ingresso `/q/{token}` (mostra o QR) |
| `event_qr_image` | PNG público do QR `/api/qr/{token}` (para embutir no e-mail) |
| `event_pdf_link` | PDF do ingresso `/api/ticket/{token}/pdf` |
| `event_checkin_status` | `qrcode_enviado` |

No editor de e-mail do GHL, use como merge tag, ex.: `{{contact.event_qr_image}}`,
`{{contact.guest_name}}`, `{{contact.event_qr_link}}`.

## Exemplo de corpo de e-mail (no workflow do cliente)
> Olá {{contact.guest_name}}, seu ingresso para **{{contact.event_name}}** está pronto!
> 📅 {{contact.event_date}} {{contact.event_time}} · 📍 {{contact.event_location}}
> Apresente o QR na entrada: imagem `{{contact.event_qr_image}}` ou abra
> {{contact.event_qr_link}}. PDF: {{contact.event_pdf_link}}

## Passo a passo (uma vez por cliente)
1. Criar os custom fields acima na location.
2. Criar o workflow: **Trigger** = "Contact Tag" contém `qrcode-enviado-` (ou a tag
   exata do evento) → **Action** = "Send Email" usando as variáveis.
3. Conectar o Spark na aba **Conexão** (token da location).
4. No evento → **Enviar convite** (canal Spark): o app grava as variáveis + a tag,
   e o workflow do cliente envia o e-mail.

## Escala: distribuir o mesmo workflow para todos os clientes (Snapshot)
Para não montar manualmente em cada subaccount, use um **Snapshot do GHL**
(recurso de agência): inclua os custom fields + o workflow no snapshot e
empurre/instale nos subaccounts. Cada cliente recebe a base pronta e só ajusta
texto/branding do e-mail. É a forma escalável do modelo workflow.

## Alternativa: configurar os e-mails CENTRALIZADO no app (sem workflow)
Se você prefere editar os e-mails de cada cliente **dentro do Spark** (no-code,
com variáveis), use o **envio direto**:
- **Resend** (e-mail direto) ou **GHL Conversations (OAuth)** — neste, o e-mail é
  composto pelos nossos **templates (aba Mensagens, por evento/tenant)** e sai
  pela identidade do próprio GHL do cliente.
- Vantagem: um só lugar para configurar, variáveis `{{nome}}`, `{{evento}}`,
  `{{link_qr}}`, `{{link_certificado}}`… por evento e por organização.
