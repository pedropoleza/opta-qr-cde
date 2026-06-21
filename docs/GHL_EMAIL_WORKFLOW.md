# Passo a passo — enviar o QR (e-mail/WhatsApp) via workflow do Spark/GHL

No modelo workflow, **o app prepara o contato e dispara a tag; o e-mail/WhatsApp
é enviado por um workflow no Spark/GHL do cliente**. Como cada contato tem um
**token único**, o QR/PDF é único por pessoa — e o workflow usa **merge tags**
(URLs por contato), então um único workflow serve todos os convidados e eventos.

---

## Parte A — O que o app faz sozinho (já pronto)
A cada **Enviar convite** (canal Spark), o app, para cada convidado:
1. Grava os **custom fields** no contato (as variáveis do e-mail).
2. Adiciona as tags-gatilho: **`qrcode-enviado`** (genérica) e
   `qrcode-enviado-{slug-do-evento}` (por evento).

## Parte B — O que VOCÊ faz (uma vez por location)

### B1. Conectar + preparar os campos (automático)
1. No app: **Conexão** → confirme "Conectado".
2. Clique em **"Preparar campos no Spark"** → o app cria automaticamente estes
   custom fields na location:

   `guest_name`, `event_name`, `event_date`, `event_time`, `event_location`,
   `event_address`, `event_qr_link`, `event_qr_image`, `event_pdf_link`,
   `event_checkin_status`

   (Se algum não puder ser criado pela API, o app avisa e você cria manualmente
   em Settings → Custom Fields com a mesma chave.)

### B2. Criar UM workflow (serve todos os eventos)
1. Automation → **Create Workflow** (em branco).
2. **Trigger**: "Contact Tag" → tag **`qrcode-enviado`**.
3. **Action "Send Email"**:
   - Assunto: `Seu ingresso — {{contact.event_name}}`
   - Corpo (use o HTML abaixo, com a imagem do QR e o botão do PDF).
4. (Opcional) **Action "Send SMS/WhatsApp"** para mandar o link/PDF (ver B4).
5. **Publique** o workflow.

### B3. Modelo de e-mail (cole no editor de e-mail do GHL)
```html
<h2>Olá, {{contact.guest_name}}!</h2>
<p>Seu ingresso para <strong>{{contact.event_name}}</strong> está pronto.</p>
<p>📅 {{contact.event_date}} {{contact.event_time}}<br/>
   📍 {{contact.event_location}} — {{contact.event_address}}</p>
<p style="text-align:center">
  <img src="{{contact.event_qr_image}}" alt="QR" width="240" height="240"/>
</p>
<p style="text-align:center">
  <a href="{{contact.event_qr_link}}">Ver meu ingresso</a> ·
  <a href="{{contact.event_pdf_link}}">Baixar PDF</a>
</p>
```
> Cada contato recebe o **seu** QR/PDF porque essas URLs têm o token dele.
> Anexo dinâmico (PDF anexado) não existe no workflow — por isso usamos a
> **imagem do QR embutida + o link do PDF** (o link abre o PDF único do contato).

### B4. WhatsApp / SMS (opcional)
- **SMS**: mande o link → `Seu ingresso: {{contact.event_qr_link}}`
- **WhatsApp (mídia)**: no campo de mídia/anexo da ação, use a URL
  `{{contact.event_pdf_link}}` → o GHL entrega o **PDF único** daquele contato.

---

## Reenvio (atenção)
A tag fica no contato após o 1º envio, então o gatilho "tag adicionada" **não
dispara de novo** se você reenviar. Para reenviar: remova a tag antes, ou use uma
ação separada. (No envio direto via Resend/Conversations não há essa limitação.)

## Escala para vários clientes
Inclua os custom fields + o workflow num **Snapshot do GHL** e instale nos
subaccounts. Cada cliente recebe a base pronta e só ajusta texto/branding.

## Alternativa centralizada (sem workflow)
Editar os e-mails de cada cliente **dentro do Spark** (aba Mensagens, com
variáveis) usando **Resend** agora ou **GHL Conversations (OAuth)** depois — neste,
o app inclusive anexa o **PDF único** e envia pela identidade do GHL do cliente.
