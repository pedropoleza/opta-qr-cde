# Plano — Inscrições, Pagamentos e Mensageria (no-code)

O app deixa de ser só "check-in" e passa a orquestrar o funil inteiro do evento:
**inscrição → pagamento → entrega do QR → lembretes**, com tudo configurável
pelo próprio organizador (sem n8n, ou com o n8n virando um relay fino).

## 1. Dores que este plano absorve (relato do cliente)

Fluxo atual (hoje no n8n):
1. Pessoa preenche um **formulário** de inscrição → dispara **webhook A** (form).
2. Pessoa é redirecionada para o **checkout no Square**.
3. Square confirma o pagamento → dispara **webhook B** (pagamento).
4. Hoje: envio manual/n8n de 1 mensagem ao inscrito.

Dores:
- A lógica de "quem pagou" vive fora do produto (n8n), difícil de manter/escalar
  por cliente.
- Mensagens (lembrete, confirmação) não são configuráveis pelo organizador.
- O QR não sai automaticamente quando o pagamento entra.

## 2. Visão — o app como orquestrador

```
Formulário  ──webhook──▶  /api/hooks/registration/{token}
                              │  cria/atualiza Convidado (status: inscrito, pagamento: pendente)
                              │  (opcional) envia "inscrição recebida"
                              ▼
Square checkout ─webhook─▶  /api/hooks/square/{token}
                              │  valida assinatura HMAC do Square
                              │  casa o pagamento ao convidado (reference_id ou e-mail)
                              │  marca PAGO → dispara REGRA "ao pagar → enviar QR"
                              ▼
                          Fila (já existe) → envia QR pelo canal escolhido
                          (e-mail / WhatsApp / workflow GHL) + lembretes agendados
```

O isolamento multi-tenant continua: cada webhook tem um **token público** que
resolve a organização/evento; segredos (assinatura) ficam cifrados.

## 3. Modelo de dados (novas tabelas/campos)

- **Guest** (campos novos):
  - `paymentStatus` (`none|pending|paid|refunded|failed`, default `none`)
  - `amountPaid` (int, centavos) · `currency` · `paidAt`
  - `paymentRef` (id do pagamento/ordem no Square) — idempotência e auditoria
  - `registrationRef` (id do envio do formulário) — correlação
- **IntegrationEndpoint** (por evento): `token` (público), `kind`
  (`registration|payment`), `provider` (`generic|square`), `secret` (cifrado),
  `fieldMap` (JSON: qual campo do payload = nome/e-mail/telefone/valor/ref),
  `active`.
- **MessageTemplate** (por org/evento): `kind`
  (`registration|payment_confirmation|qr_delivery|reminder`), `channel`
  (`email|whatsapp|ghl`), `subject?`, `body` (com variáveis), `active`.
- **ReminderRule** (por evento): `offsetHours` (ex.: −72, −24, −2), `templateId`,
  `channel`, `active`, `lastRunAt`.
- **WebhookEvent** (idempotência): `provider`, `externalId` único, `receivedAt`,
  `status` — evita processar o mesmo webhook 2x (Square reenvia).

Reaproveita: `Ticket` (QR assinado), fila `GhlSyncJob` (envio assíncrono com
backoff), `EmailLog`, canais `email.ts`/`stevo.ts`/GHL.

## 4. Webhooks de entrada

### 4.1 Inscrição (genérico — qualquer form)
`POST /api/hooks/registration/{token}`
- Resolve o evento pelo token; aplica `fieldMap` ao corpo recebido.
- **Upsert** do convidado por e-mail (ou `registrationRef`): cria como
  `inscrito / pagamento pendente`. Respeita capacidade (#1): se lotado → espera.
- (Opcional) dispara o template `registration` no canal configurado.

### 4.2 Pagamento (Square)
`POST /api/hooks/square/{token}`
- **Verificação de assinatura**: HMAC-SHA256 sobre `notificationUrl + rawBody`
  com a *Webhook Signature Key* do Square; compara com
  `x-square-hmacsha256-signature`. Rejeita se não bater.
- Idempotência via `WebhookEvent.externalId` (id do evento Square).
- Tipos: `payment.created|payment.updated` com `status = COMPLETED`
  (ou `refund.*` → `refunded`).
- **Correlação** pagamento ↔ inscrição:
  - Preferencial: `reference_id` (id do convidado, setado no checkout) →
    casamento 1:1 e à prova de homônimos.
  - Fallback: `buyer_email_address`.
- Ao casar: marca `paid` + valor/`paidAt`/`paymentRef` → executa a regra
  **"ao pagar → enviar QR"** (gera/garante o ticket e enfileira o envio).

> Decisão: o app recebe o webhook do Square **direto** (substitui o n8n) **ou** o
> n8n continua e só chama a API do app? As duas funcionam; recomendo direto para
> simplificar, mantendo a API aberta caso queira manter o n8n como relay.

## 5. Motor de automação (regras configuráveis, no-code)

Por evento, com toggles:
- **Ao inscrever (form)** → enviar template `registration` [canal].
- **Ao confirmar pagamento** → enviar QR (template `qr_delivery`) [canal]. ← núcleo
- **Lembretes** → lista de `ReminderRule` (D-3, D-1, 2h antes…) [canal].
- (Futuro) **No-show / pós-evento** → pesquisa/certificado (entra na feature #9/#10).

## 6. Templates e variáveis

Editor por evento (com padrão por organização). Variáveis suportadas:
`{{nome}}`, `{{evento}}`, `{{data}}`, `{{hora}}`, `{{local}}`, `{{endereco}}`,
`{{valor}}`, `{{link_qr}}`, `{{link_ingresso}}`.
Ex. lembrete: "Olá {{nome}}! Seu acesso ao {{evento}} é {{data}} às {{hora}} em
{{local}}. Seu QR: {{link_qr}}".

## 7. Lembretes (agendados)

- Cada `ReminderRule` tem um `offsetHours` relativo ao início do evento.
- O **cron que já existe** (worker da fila, 1/min) passa a também varrer regras
  cujo horário chegou e que ainda não rodaram (`lastRunAt`), enfileirando os
  envios para os convidados elegíveis (ex.: só pagos, ou todos confirmados).

## 8. Canais de envio

Reutiliza o que já existe: **e-mail (Resend)**, **WhatsApp (Stevo)** — pendente
de API key válida — e **workflow do GHL via tag**. O organizador escolhe o canal
por regra/template. Fallback configurável (ex.: WhatsApp → e-mail).

## 9. Segurança & robustez

- Assinatura HMAC obrigatória no webhook do Square; segredos cifrados (AES-GCM,
  como já fazemos com o token GHL).
- Idempotência por `externalId` (sem QR duplicado se o Square reenviar).
- Rate limiting já cobre rotas públicas (Fase 5) — estendemos aos `/api/hooks/*`.
- Tudo escopado por organização (token → evento → org).

## 10. UI de configuração

Nova aba **"Inscrições & Pagamentos"** no evento:
- URLs dos webhooks (copiar) + chave de assinatura do Square + mapeamento de
  campos do formulário.
- Toggles de automação (inscrição → msg, pago → QR).
- Editor de templates (com pré-visualização e variáveis).
- Agenda de lembretes (adicionar D-x, escolher template/canal).
- Painel: inscritos vs pagos vs QR enviados (alimenta a feature #10 Analytics).

## 11. Fases de entrega

- **F1 — Pagamentos & QR automático (núcleo):** campos de pagamento no convidado,
  webhook genérico de inscrição, webhook do Square (assinado + idempotente),
  regra "ao pagar → enviar QR". *Resolve a dor principal.*
- **F2 — Templates & no-code:** editor de mensagens com variáveis + escolha de
  canal + template de confirmação/inscrição.
- **F3 — Lembretes agendados:** `ReminderRule` + varredura no cron.
- **F4 — Painel de inscrições/pagamentos** e amarração com Analytics (#10).

## 12. Decisões necessárias (de você)

1. **Square direto** (app recebe o webhook) ou **n8n como relay** (n8n chama a API
   do app)?
2. **Correlação**: dá para colocar o id da inscrição como `reference_id` no
   checkout do Square? (melhor) Ou casamos por **e-mail**?
3. **Canal principal** de envio do QR e dos lembretes: e-mail (Resend, pronto),
   WhatsApp (Stevo, depende de key válida) ou workflow do GHL (tag)?
4. Itens necessários: **Webhook Signature Key** do Square (e os tipos de evento
   assinados) — só você gera no painel de desenvolvedor do Square.
