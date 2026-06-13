# Spark Check-in — Registro de Decisões (D1–D7)

Decisões da seção 2.5 do documento de implementação V1.1, registradas em
13/06/2026. D4, D5 e a infraestrutura de banco foram confirmadas pelo Time;
as demais seguem a recomendação explícita do próprio documento e podem ser
revistas antes da Etapa 3/4.

| # | Decisão | Status |
|---|---------|--------|
| D1 | **Híbrida (C)** — app envia (provedor próprio) e grava status no contato GHL. Implementação na Etapa 3. | Recomendação do documento — confirmar antes da Etapa 3 |
| D2 | **Link clicável** que abre página hospedada com o QR (`/q/{token}`), em vez de imagem embedada no e-mail. | Recomendação do documento |
| D3 | Custom fields no contato GHL: `event_name`, `event_date`, `event_qr_link`, `event_checkin_status`, `event_checked_in_at`, `event_ticket_id`. | Sugestão do documento — Time cria no GHL na Etapa 4 |
| D4 | **Link + PIN temporário por evento** para o Checker (`/checker/{token}` + PIN de 6 dígitos). Sem login do organizador e sem acesso a dados sensíveis. | ✅ Confirmada pelo Time |
| D5 | Capacity atingida: **alerta e libera** — o check-in é efetuado e o Checker vê aviso de capacidade excedida. | ✅ Confirmada pelo Time |
| D6 | **Multi-tenant desde a V1** — `organization_id` em todo o schema, escopo no JWT e em toda query. | Recomendação do documento |
| D7 | Fila de sincronização GHL: **tabela `checkin_ghl_sync_jobs` no próprio Postgres**, processada por cron (Vercel Cron na Etapa 4). Retry sugerido: 5 tentativas com backoff exponencial (1min, 5min, 15min, 1h, 6h). | Padrão adotado — confirmar provider/retry antes da Etapa 4 |

## Infraestrutura

- **Banco**: projeto Supabase **Sparkleads OS** (`nsqwgjbgcdqyzozyaltz`), confirmado pelo Time.
  Como o banco é compartilhado com outros domínios, todas as tabelas do
  Spark Check-in usam o prefixo `checkin_` (ex.: `checkin_events`,
  `checkin_tickets`). Migration `init_spark_checkin` aplicada em 13/06/2026,
  com RLS habilitado (acesso do app é server-side via Prisma).
- **Hospedagem**: Vercel (a provisionar pelo Time — Etapa 5).

## Pendências 👤 Time (bloqueadores das próximas etapas)

- [ ] Gerar `JWT_SIGNING_KEY` e `TICKET_TOKEN_SECRET` de produção (32+ bytes) e adicionar na Vercel.
- [ ] Adicionar `DATABASE_URL` de produção (connection string do Sparkleads OS com senha) na Vercel.
- [ ] Definir `APP_BASE_URL` (domínio do app).
- [ ] Confirmar D1 (estratégia de e-mail) antes da Etapa 3.
- [ ] Criar app no GHL Developer Portal (`GHL_CLIENT_ID`/`SECRET`) e registrar a redirect URI — Etapa 4.
- [ ] Criar os custom fields D3 no HighLevel — Etapa 4.
