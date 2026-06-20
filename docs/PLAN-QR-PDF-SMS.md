# Plano — Disparo do QR por PDF + SMS (GHL / Stevo)

Objetivo: além do e-mail, permitir entregar o ingresso (QR Code) **como PDF** e
disparar por **SMS** usando o provedor conectado na subaccount do GHL (ex.:
Stevo / LeadConnector). Mantém o modelo D1 já adotado: **o app prepara o contato
e aciona a tag-gatilho; o workflow nativo do GHL envia** (e-mail ou SMS). Assim,
qualquer provedor de SMS conectado na location funciona sem integração direta.

## 1. Visão geral da arquitetura

```
App (Spark Check-in)                         GHL (subaccount)
─────────────────────                        ─────────────────
gera ticket (token+HMAC)
gera PDF do ingresso  ── URL pública ──┐
grava custom fields  ──────────────────┼──► contato atualizado
aplica tag-gatilho por canal ──────────┘     │
   • qrcode-enviado-{slug}  (e-mail)          ├─ workflow e-mail  → envia e-mail
   • qrcode-sms-{slug}      (SMS)             └─ workflow SMS     → Stevo/LC envia SMS
enfileira jobs (checkin_ghl_sync_jobs)
worker aplica no contato (já existe)
```

Princípios:
- **SMS não embeda imagem** → a mensagem leva um **link** (página do ingresso
  `/q/{token}` e/ou o **PDF** `/api/ticket/{token}/pdf`).
- **PDF é gerado pelo app**, sob URL pública (igual ao PNG `/api/qr/{token}`),
  para ser linkado tanto no e-mail quanto no SMS, e para o convidado salvar/imprimir.
- **Reuso máximo**: mesma fila/worker, mesmo padrão de tags, mesma UI de disparo
  com um seletor de canal.

## 2. Componentes a construir (lado do app)

### 2.1 Geração do PDF do ingresso
- **Rota:** `GET /api/ticket/[token]/pdf` (pública, igual ao PNG do QR).
- **Lib:** `pdf-lib` (JS puro, funciona em serverless/Vercel; embeda PNG e
  desenha texto com fontes padrão — sem dependência nativa).
- **Conteúdo:** nome do evento, data/horário, local, nome do convidado, a
  **imagem do QR** (gerada via `qrcode.toBuffer`, sem self-call HTTP), instrução
  de uso e o link curto da página do ingresso.
- **Segurança:** valida o `token`/assinatura HMAC como a rota do QR já faz;
  ticket inválido → 404.
- **Saída:** `application/pdf`, `Content-Disposition: inline; filename="ingresso-{slug}.pdf"`.

### 2.2 Custom fields novos (👤 Time cria no GHL)
- `event_qr_pdf` — URL do PDF do ingresso (`{APP_BASE_URL}/api/ticket/{token}/pdf`).
- (reusa os D3 existentes: `event_qr_link`, `event_qr_image`, `event_name`, etc.)

### 2.3 Disparo por canal
- **Endpoint:** estender `POST /api/events/:id/send` com `channel: "email" | "sms" | "both"`
  (default `email`, retrocompatível).
- **Para SMS**, enfileira:
  - `update_fields`: `event_qr_pdf`, `event_qr_link`, dados do evento.
  - `add_tag`: **`qrcode-sms-{slug}`** (gatilho do workflow de SMS).
- **Para e-mail** (já existe): `qrcode-enviado-{slug}`.
- **Both**: aplica os dois conjuntos.

### 2.4 Rastreamento de entrega
- Reusar `EmailLog` como log de entrega genérico, com `provider`:
  - `ghl` (e-mail, já usado) e **`ghl-sms`** (SMS).
- Worker (já existe) marca como `sent` ao aplicar a respectiva tag-gatilho
  (estender a regra atual de `qrcode-enviado-` para também cobrir `qrcode-sms-`).
- Opcional (fase 2): coluna `channel` em `EmailLog` ou tabela `DeliveryLog`
  dedicada, se quisermos métricas separadas por canal (requer migration).

### 2.5 UI (aba QR Delivery)
- Seletor de canal no disparo em massa: **E-mail · SMS · Ambos**.
- No card/Drawer por convidado: ações "Enviar e-mail", "Enviar SMS", e
  "Baixar PDF" / "Ver PDF".
- Badges de entrega por canal (e-mail enviado / SMS enviado).
- Pré-visualização do PDF (abre `/api/ticket/{token}/pdf` em nova aba).

## 3. Tarefas do 👤 Time no GHL (não dá por código)
1. Criar custom field `event_qr_pdf` (+ os D3 que ainda faltam).
2. **Workflow de SMS**: gatilho *Contact Tag Added* = `qrcode-sms-{slug}`,
   ação *Send SMS* com corpo curto + link `{{contact.event_qr_pdf}}` (ou
   `{{contact.event_qr_link}}`). O envio é feito pelo provedor conectado
   (Stevo / LeadConnector) — o app não fala com o provedor diretamente.
3. Garantir que o número/serviço de SMS da location esteja ativo e com créditos.

## 4. Fases de execução
- **Fase 1 — PDF**: rota `/api/ticket/[token]/pdf` (pdf-lib) + botões "Ver/Baixar
  PDF" no app. Entrega imediata de valor (ingresso imprimível), independe do GHL.
- **Fase 2 — Canal SMS**: `channel` no `/send`, tags `qrcode-sms-{slug}`,
  custom field `event_qr_pdf`, worker marca SMS `sent`, UI com seletor de canal.
- **Fase 3 — Métricas por canal** (opcional): separar logs e-mail/SMS, painel.

## 5. Decisões em aberto (definir antes de implementar)
1. **O que é "Stevo"?** Provedor de SMS conectado na location (rota via workflow,
   recomendado) **ou** serviço com API própria (integração direta, mais trabalho)?
2. **Conteúdo do SMS:** linkar o **PDF** (`event_qr_pdf`) ou a **página do
   ingresso** (`/q/{token}`)? (Recomendado: página do ingresso, que já mostra o
   QR e tem botão para o PDF — link mais curto e flexível.)
3. **PDF no e-mail:** apenas link (recomendado) ou também anexo? (Anexo exige o
   GHL suportar attachment dinâmico no workflow.)
4. **Layout/branding do PDF:** usar identidade "Spark" white-label; precisa de
   logo? (Por ora, cabeçalho textual.)

## 6. Riscos / observações
- **Custo de SMS** e limites de caracteres (usar link curto; GHL encurta).
- **Opt-in/compliance** de SMS (consentimento) é responsabilidade do workflow/Time.
- **PDF em serverless**: `pdf-lib` é leve; evitar libs com binário nativo
  (`puppeteer`/headless chrome) que estouram o tamanho da função na Vercel.
- Sem token/custom fields/worker do GHL configurados, o SMS não sai — mas o
  **PDF e os links funcionam de imediato** (não dependem do GHL).
