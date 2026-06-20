# Plano — Ingresso em PDF + disparo por WhatsApp (Stevo) com editor de modelo

Objetivo: gerar o ingresso (QR Code) como **PDF com design moderno e editável**
e dispará-lo por **WhatsApp através da API do Stevo** (integração direta),
puxando dados do **evento** e do **contato**. O e-mail continua pelo modelo D1
(workflow do GHL). O WhatsApp, por decisão do produto, é **enviado diretamente
pelo app via Stevo** (não pelo GHL).

## 1. Visão geral

```
App (Spark Check-in)
─────────────────────
gera ticket (token+HMAC)
renderiza PDF do ingresso (modelo editável) ── URL pública /api/ticket/{token}/pdf
                                                   │
enfileira job send_whatsapp (fila já existe) ──► worker chama API do Stevo
   payload: { to, mediaUrl(PDF), caption }            │
                                                       └─► Stevo entrega o PDF no WhatsApp
e-mail continua: tag qrcode-enviado-{slug} → workflow GHL
```

Decisões já tomadas:
- **Canal WhatsApp = Stevo, API direta** (app → Stevo). Não usa workflow do GHL.
- **WhatsApp envia o PDF** (documento), com legenda curta + link da página do
  ingresso como fallback.
- **PDF é editável** por um modelo (template) com padrão moderno.

## 2. Geração do PDF (com modelo editável)

### 2.1 Renderização
- **Lib:** `@react-pdf/renderer` (JS puro, serverless-friendly; layout rico tipo
  flexbox, estilos, imagens). Mais flexível que `pdf-lib` para um design moderno.
- **Rota pública:** `GET /api/ticket/[token]/pdf` — valida token/HMAC, monta o
  PDF a partir do **modelo + dados do evento + dados do contato + QR** (gerado
  via `qrcode.toBuffer`, sem self-call), retorna `application/pdf`.
- **Preview:** `GET /api/ticket/preview/pdf?eventId=...` com dados de exemplo,
  para o editor mostrar o resultado ao vivo.

### 2.2 Modelo (template) editável
- **Armazenamento:** novo registro de modelo (migration). Sugestão:
  `TicketTemplate` com escopo por **organização** (padrão) e **override por
  evento** (opcional). Campos (JSON `config`):
  - `brandColor`, `accentColor`, `logoUrl`
  - `headerTitle`, `subtitle`, `footerText`, `instructions`
  - toggles: mostrar e-mail, horário, local, telefone
  - `layout`: preset (`classic` | `modern` | `compact`)
- **Merge fields** disponíveis no texto: `{{event.name}}`, `{{event.date}}`,
  `{{event.time}}`, `{{event.location}}`, `{{contact.name}}`,
  `{{contact.email}}`, `{{contact.phone}}`.
- **Renderer:** um componente React-PDF que recebe `(config, event, contact, qr)`
  e desenha o layout do preset escolhido.

### 2.3 Editor (UI)
- Painel **"Modelo do ingresso"** (Drawer/aba de Configurações) com:
  - formulário dos campos do `config` (cor, logo, textos, toggles, preset);
  - **preview ao vivo** (iframe apontando para `/api/ticket/preview/pdf` com os
    dados atuais e de exemplo do contato);
  - botão Salvar (org) e "Usar neste evento" (override).
- Estados: loading/erro do preview; "alterações não salvas" ao fechar.

## 3. Disparo por WhatsApp (Stevo, direto)

### 3.1 Integração
- **Env vars:** `STEVO_API_URL`, `STEVO_API_TOKEN` e o identificador do
  remetente/instância do WhatsApp (ex.: `STEVO_SENDER` / `STEVO_INSTANCE`).
  > ⚠️ Preciso da **documentação/credenciais do Stevo** (endpoint de envio de
  > documento/mídia, formato do payload e autenticação).
- **Cliente:** `lib/stevo.ts` com `sendWhatsappDocument({ to, mediaUrl, filename, caption })`.

### 3.2 Fila / worker (reuso)
- Nova ação na fila `checkin_ghl_sync_jobs` (ou tabela própria): **`send_whatsapp`**
  com payload `{ to, mediaUrl, caption }`.
- O **worker** (já existe, com retry/backoff D7) ganha o case `send_whatsapp` que
  chama `lib/stevo.ts`. Reaproveita claim atômico e reprocessamento.
- **mediaUrl** = `{APP_BASE_URL}/api/ticket/{token}/pdf` (Stevo baixa o PDF da URL
  pública). Se o Stevo exigir upload em vez de URL, adicionamos um passo de upload.

### 3.3 Endpoint de disparo
- Estender `POST /api/events/:id/send` com `channel: "email" | "whatsapp" | "both"`.
  - `whatsapp`: valida telefone do convidado, enfileira `send_whatsapp`.
  - `email`: fluxo atual (tag GHL).
- **Pré-requisito:** convidado precisa de **telefone** (WhatsApp). Importação do
  Spark e CSV já trazem telefone; sinalizar quem não tem.

### 3.4 Rastreamento
- Reusar `EmailLog` como log de entrega com `provider: "stevo-whatsapp"`
  (status `queued`/`sent`/`error`), atualizado pelo worker ao enviar.

## 4. UI de disparo (aba QR Delivery + Drawer do convidado)
- Seletor de canal: **E-mail · WhatsApp · Ambos**.
- Botões por convidado: "Enviar WhatsApp", "Ver/Baixar PDF".
- Badges de entrega por canal; aviso para quem não tem telefone.

## 5. Migrations / schema
- `TicketTemplate` (org + evento opcional) com `config Json`.
- (Opcional) `channel`/`provider` já cobre no `EmailLog`; senão tabela
  `DeliveryLog` dedicada se quisermos métricas finas por canal.

## 6. Fases de execução
- **Fase 1 — PDF + modelo padrão:** rota do PDF (react-pdf) com 1 preset moderno
  + botões "Ver/Baixar PDF". Valor imediato, independe de Stevo/GHL.
- **Fase 2 — Editor do modelo:** painel de configuração + preview ao vivo +
  persistência (`TicketTemplate`).
- **Fase 3 — WhatsApp (Stevo):** `lib/stevo.ts` + ação `send_whatsapp` no worker
  + `channel` no `/send` + UI. **Depende das credenciais/doc do Stevo.**

## 7. Decisões

Decididas:
- ✅ **Editor de PDF:** painel de configuração com **presets** (moderno/clássico/
  compacto) + cor, logo, textos e toggles. Sem editor visual avançado.
- ✅ **Escopo do modelo:** **padrão por organização + override por evento**.

Pendentes (bloqueiam só a Fase 3 — WhatsApp):
1. **Credenciais e doc da API do Stevo** (endpoint de envio de documento via
   WhatsApp, autenticação, formato do payload, remetente/instância).
2. **Stevo aceita `mediaUrl` (link público do PDF) ou exige upload do arquivo?**

## 8. Riscos / observações
- **Compliance WhatsApp** (opt-in, janela de 24h, templates aprovados) pode se
  aplicar dependendo de como o Stevo opera — confirmar com a doc do Stevo.
- **react-pdf** é leve o suficiente para Vercel; evitar headless chrome.
- **Telefone obrigatório** para WhatsApp; tratar convidados sem número.
- Segredos do Stevo via env (nunca no repo); rotacionar após go-live.
