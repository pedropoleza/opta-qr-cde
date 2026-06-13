# Spark Check-in

Credenciamento digital por QR Code integrado ao HighLevel (GHL), dentro do
ecossistema SparkLeads. O organizador cria eventos, importa convidados (CSV na
V1; GHL na Etapa 4), gera um QR Code único e assinado por convidado e valida a
presença na entrada pelo **modo Checker** — cada QR só faz check-in uma vez.

Implementação conforme o documento **Spark Check-in — Implementação V1 (v1.1)**.
Decisões D1–D7 registradas em [`docs/DECISOES.md`](docs/DECISOES.md).

## Stack

Next.js (App Router) · TailwindCSS · shadcn/ui · Prisma · Postgres (Supabase)

## Estado das etapas

- ✅ **Etapa 0 — Preparação**: repositório, schema Prisma e migration aplicada
  no Supabase (Sparkleads OS, tabelas com prefixo `checkin_`).
- ✅ **Etapa 1 — Foundation**: login do organizador (JWT), layout com sidebar,
  Dashboard, CRUD de eventos multi-tenant, Event Detail com abas.
- ✅ **Etapa 2 — Convidados + QR + Scanner**: importação CSV/manual, geração de
  ticket (token + HMAC), QR Preview (PNG/link), Guest List com ações, endpoint
  atômico `/api/checkin/validate`, Checker Mode mobile-first (link + PIN) com
  as 4 respostas visuais, métricas reais e fila `checkin_ghl_sync_jobs`
  alimentada no check-in/encerramento.
- ⏳ **Etapa 3 — Envio de e-mail** (depende de confirmação de D1).
- ⏳ **Etapa 4 — Integração HighLevel** (OAuth, contatos por tag, worker da fila).
- ⏳ **Etapa 5 — Go-Live + Hypercare**.

## Regras centrais (seções 2.x do documento)

- O QR contém `{APP_BASE_URL}/checkin/validate?token={token}&sig={hmac}`;
  o servidor recalcula `HMAC_SHA256(event_id + guest_id + token,
  TICKET_TOKEN_SECRET)` a cada scan — token forjado/alterado é inválido.
- Check-in é **atômico**: transação com `SELECT ... FOR UPDATE` na linha do
  ticket; dois celulares escaneando o mesmo QR ao mesmo tempo não duplicam.
- Respostas do Checker: 🟢 check-in ok · 🟡 já usado · 🔴 inválido ·
  ⬜ ticket de outro evento. Capacity atingida **alerta e libera** (D5).
- Check-in **nunca** acontece por GET — a página da URL do QR só exibe estado.
- Rastreamento GHL por tags `convidado-/qrcode-enviado-/presente-evento-/
  no-show-{slug-do-evento}`, enfileirado em `checkin_ghl_sync_jobs`
  (worker na Etapa 4).

## Desenvolvimento local

```bash
npm install
cp .env.example .env   # preencher DATABASE_URL, JWT_SIGNING_KEY, TICKET_TOKEN_SECRET
npx prisma migrate dev
npx prisma db seed     # cria org SparkLeads + usuário (SEED_ADMIN_EMAIL/PASSWORD)
npm run dev
```

Fluxo de teste ponta-a-ponta: login → criar evento → ativar (Configurações) →
importar CSV de convidados → gerar QR Codes → aba Checker (link + PIN) → abrir
no celular e escanear.
