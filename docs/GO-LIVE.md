# Spark Check-in — Go-Live & Uso Prático

Estado e passos para colocar em produção de verdade. Atualizado nesta sessão.

## Status (resumo)
- ✅ Núcleo (evento → convidados → QR → check-in atômico → Checker) — funcionando
- ✅ GHL/Contatos (token no banco `checkin_ghl_connections`) — conectado (Opta Finance)
- ✅ UI white-label, PDF + editor, animações, 9 features de evento
- ✅ Envio de e-mail DIRETO (Resend) — pronto, falta a chave
- ⏳ WhatsApp (Stevo) — código pronto, falta apikey válida
- ⏳ E-mail via workflow GHL — alternativa; depende do Time (campos D3 + workflow)
- ⚠️ Controle de acesso da URL pública — ver "Hardening"

## 1. Ativar o envio de e-mail (recomendado — destrava o uso prático)
O app envia o ingresso direto via **Resend** (não depende do GHL).
1. Crie conta em https://resend.com (free) e **verifique um domínio** (ou use o
   remetente de teste do Resend para validar).
2. No Vercel → Environment Variables (Production), adicione:
   - `RESEND_API_KEY` = a API key do Resend
   - `EMAIL_FROM` = `Spark Check-in <ingresso@seudominio.com>`
3. Redeploy.
4. Em um evento: gere os QR Codes → aba QR Delivery → "Enviar por: E-mail" →
   o convidado recebe o e-mail com QR + botão + PDF. (O worker/cron processa a
   fila; o status vira "Entregue" no Drawer do convidado.)

> Sem `RESEND_API_KEY`, o canal e-mail usa o modelo GHL (tag-gatilho), que exige
> o workflow do Time (seção 3).

## 2. Ativar o WhatsApp (Stevo)
Falta uma **apikey válida** da instância (a atual retorna 401 em todos os
servidores do Stevo). Quando o suporte do Stevo fornecer uma chave que retorne
200 em `GET https://smv2-7.stevo.chat/instance/status`:
1. Vercel → `STEVO_API_URL` = `https://smv2-7.stevo.chat`, `STEVO_API_KEY` = chave.
2. Redeploy → aba QR Delivery → "Enviar por: WhatsApp" envia o PDF do ingresso.

## 3. (Alternativa) E-mail via workflow GHL — 👤 Time
1. Criar custom fields: `event_name`, `event_date`, `event_location`,
   `event_qr_link`, `event_qr_image`, `event_checkin_status`, `event_checked_in_at`.
2. Workflow: gatilho tag `qrcode-enviado-{slug}` → Send Email (template em
   `docs/GHL_EMAIL_WORKFLOW.md`).

## 4. UAT — roteiro de teste ponta-a-ponta
1. Criar evento → ativar (Configurações).
2. Convidados: importar CSV + adicionar manual (com categoria e +acompanhantes)
   + "Importar do Spark" por tag.
3. Gerar QR Codes.
4. Enviar convite (E-mail e/ou WhatsApp) → confirmar recebimento real.
5. Abrir o e-mail/PDF no celular → escanear no Checker (link + PIN):
   - verde (entrada) → ver animação de sucesso + categoria;
   - escanear de novo → amarelo (duplicado);
   - testar Buscar por nome, Walk-in, Desfazer, Check-in de grupo.
6. Painel ao vivo: acompanhar presentes/ritmo.
7. Sessões: criar sessão com capacidade, atribuir convidado, ver ocupação.
8. RSVP: confirmar presença na página do ingresso.
9. Offline: no celular, desligar o Wi-Fi, escanear (tela OFFLINE), religar →
   sincroniza sozinho.

## 5. Hardening para produção
- **Acesso**: a URL pública (`/`, `/events`, `/contacts`) hoje é **aberta**. Ok
  se embutida no CRM via SSO; como URL avulsa, qualquer um acessa. Decidir:
  (a) restringir `frame-ancestors` ao domínio do CRM + confiar no embed, ou
  (b) adicionar um gate (PIN/sessão) para o painel do organizador.
- **Rotação de segredos**: PIT do GHL, futura chave Stevo/Resend e secrets do app
  passaram por chat — rotacionar após go-live. (O PIT do GHL vive em
  `checkin_ghl_connections`; basta atualizar a linha.)
- **Cron**: confirmar no Vercel que o cron `/api/ghl/sync/process` está ativo
  (processa e-mail/WhatsApp/tags). Plano precisa permitir a frequência.
- **Monitoramento**: acompanhar `EmailLog` (status `error`) e
  `checkin_ghl_sync_jobs` (status `failed`) após os primeiros envios.

## 6. Pós go-live
- Tag de release, hypercare 7 dias, acompanhar a fila e os logs.
