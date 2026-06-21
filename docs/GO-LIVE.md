# Spark Check-in — Checklist de Go-Live

Estado atual e passos concretos para colocar em produção.
Produção: https://spark-qrcode-checker.vercel.app · branch `main` (deploy Vercel).
Diagnóstico ao vivo: `GET /api/health` (mostra env, canais e prontidão).

---

## 0. Já pronto (verde)
- [x] Infra: Postgres (Supabase), segredos, **cron de 1 min** (`/api/ghl/sync/process`) processando fila + lembretes.
- [x] Login multi-tenant (Supabase Auth) + conta owner.
- [x] Conexão Spark por organização (token cifrado) — Opta conectada.
- [x] Eventos, convidados, **check-in** (scan, totem, multi-porta, entrada/saída, VIP), capacidade/espera, acompanhantes.
- [x] **Pagamentos** (webhooks de inscrição + Square → pago → QR), mensagens no-code, lembretes, painel de receita.
- [x] **Design** dos PDFs (ingresso/crachá/certificado): presets, efeitos, fundos, arte VIP, upload de logo, white-label.
- [x] Filtro por **tag** em Contatos + **tag por evento** nas Configurações.

---

## 1. Destravar o ENVIO (único bloqueio real) — escolha ao menos 1 canal

### Opção A — E-mail direto via Resend (recomendado p/ go-live imediato)
- [ ] Criar conta em resend.com e **verificar um domínio**.
- [ ] Na Vercel (Production) adicionar:
  - `RESEND_API_KEY` = chave do Resend
  - `EMAIL_FROM` = `Spark Check-in <ingresso@seudominio.com>`
- [ ] Redeploy. Confere em `/api/health` → `channels.email_resend: true`.
- Resultado: **Enviar convite**, **pago→QR** e **lembretes** passam a enviar e-mail direto.

### Opção B — Workflow do GHL (sem Resend)
- [ ] No subaccount, criar workflow disparado pela tag `qrcode-enviado-{slug}` que
      envia o e-mail usando os campos gravados no contato (ver `GHL_EMAIL_WORKFLOW.md`).
- Mantém o token atual; não precisa de Resend.

### Opção C — WhatsApp (Stevo)
- [ ] Fornecer uma **apikey válida** do Stevo (a atual retorna 401).
- [ ] Na Vercel: `STEVO_API_URL`, `STEVO_API_KEY`. Confere em `/api/health` → `channels.whatsapp_stevo: true`.

---

## 2. Inscrições & Pagamentos (Square) — se for usar o funil
- [ ] No evento → **Inscrições & Pagamentos**: apontar o formulário para a **URL de inscrição**.
- [ ] No Square (Developer → Webhooks): cadastrar a **URL de pagamento** + colar a **Webhook Signature Key**.
- [ ] Como o checkout é link estático, garantir **mesmo e-mail** no form e no Square (casamento por e-mail).
- [ ] Definir o canal de envio do QR (Spark/WhatsApp/e-mail) na mesma aba.

---

## 3. Segurança / hardening (antes de abrir)
- [ ] Setar **`CRON_SECRET`** na Vercel (hoje o endpoint do cron está aberto).
- [ ] 🔐 **Rotacionar os segredos** que passaram por chat:
  - `JWT_SIGNING_KEY`, `TICKET_TOKEN_SECRET`
  - token do GHL (reconectar) · senha do Postgres (Supabase)
  - **trocar a senha temporária do login** (`info@sparkleads.pro`)
- [ ] Confirmar que o Supabase Auth está com "Confirm email" do jeito desejado.

---

## 4. Conexão por OAuth do Marketplace (FASE FUTURA — deixar para depois)
Já implementado no código (gated). Quando quiser ligar o self-service + envio
direto via Conversations:
- [ ] Criar app no GHL Marketplace (sub-account).
- [ ] Redirect URL: `https://spark-qrcode-checker.vercel.app/api/ghl/oauth/callback`
- [ ] Scopes: `contacts.write contacts.readonly conversations.write conversations.readonly conversations/message.write locations.readonly`
- [ ] Vercel: `GHL_CLIENT_ID`, `GHL_CLIENT_SECRET`.
- [ ] Conexão → "Conectar com o Spark".

---

## 5. Verificação final (smoke test)
- [ ] `GET /api/health` → `ok:true` e `ready_to_deliver:true`.
- [ ] Criar evento de teste → adicionar 1 convidado → gerar QR → **Enviar convite** → confirmar recebimento.
- [ ] Abrir o **Checker** (link + PIN) → escanear o QR → confirmar check-in (verde).
- [ ] (Se usar pagamentos) disparar um pagamento de teste → confirmar `pago` + QR enviado.
- [ ] Conferir o **Painel ao vivo** e a aba **Atividade**.
