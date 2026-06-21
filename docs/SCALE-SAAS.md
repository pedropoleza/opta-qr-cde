# Spark Check-in — Arquitetura para SaaS multi-tenant escalável

Como transformar o app (hoje single-tenant embutido) em um produto aberto para
vários clientes, escalável. Foco em isolamento, autenticação, billing e escala.

## 1. O que JÁ está pronto para multi-tenant
- **Schema multi-tenant**: `organization_id` em eventos/convidados/conexões etc.
  (D6 — decidido desde a V1). Falta apenas *escopar as queries pelo tenant logado*.
- **Conexão por organização**: `checkin_ghl_connections` guarda credencial por
  org (já usamos para resolver o token) — base para cada cliente conectar o
  **próprio** GHL.
- **Modelo de ingresso por organização** (editor de PDF) — branding por tenant.
- **Serverless (Vercel) + pooler do Supabase** (pgbouncer transaction) — escala
  horizontal e conexões adequadas a serverless.
- **Fila no Postgres + worker/cron** — base para processamento assíncrono.

## 2. O que falta (gaps para virar SaaS)
1. **Autenticação + identidade do tenant** (hoje `getCurrentOrg()` pega a 1ª org).
2. **Onboarding self-service** (signup → cria organização → convida equipe).
3. **Cada cliente conecta o PRÓPRIO GHL** via OAuth (não um PIT compartilhado).
4. **Isolamento reforçado** (toda query escopada por org; idealmente RLS no
   Postgres como segunda barreira).
5. **Billing/planos** (Stripe) + limites por plano (nº de eventos/convidados).
6. **Escala do worker** (fila dedicada quando o volume crescer).
7. **Rate limiting, observabilidade, LGPD** (export/exclusão, auditoria).
8. **Domínios/branding por tenant** (white-label).

## 3. Dois caminhos de distribuição (decisão-chave)

### Caminho A — App do GHL Marketplace (recomendado se os clientes são do GHL)
O produto já é "GHL-native" e roda embutido como iframe. O modelo natural:
- Listar no **GHL Marketplace**; cada sub-account **instala** o app → **OAuth**
  gera token por location → grava em `GhlConnection` (por org) criptografado.
- **SSO do GHL** entrega o contexto de usuário/location dentro do iframe → **não
  precisamos construir login**: o tenant é a location do GHL.
- Isolamento: `organization_id` ↔ `ghl_location_id`.
- **Reaproveita ~tudo que já existe.** É o caminho mais rápido para escalar para
  clientes que já usam GHL.

### Caminho B — SaaS standalone (clientes fora do GHL)
- **Auth própria**: recomendo **Clerk** (Organizations, convites, papéis prontos
  — mais rápido) ou **Supabase Auth** (mais barato, integra com a RLS, mais
  trabalho). Auth.js (NextAuth) é a opção open-source.
- Signup → cria org → onboarding → conectar GHL (opcional) via OAuth.
- **Billing**: Stripe (planos + limites + portal do cliente).

> **Recomendação:** começar pelo **Caminho A** (Marketplace + OAuth + SSO) para
> escalar rápido entre clientes GHL, e adicionar o **Caminho B** (auth/billing
> próprios) quando quiser público fora do GHL. Os dois coexistem: o tenant é a
> organização; a forma de autenticar é que muda.

## 4. Isolamento de dados (multi-tenant)
- **Modelo**: banco único, schema único, `organization_id` em todas as linhas
  (já é assim) — escala para milhares de tenants.
- **App layer**: um único ponto resolve `organizationId` a partir da sessão
  (SSO do GHL ou auth) e TODA query passa a filtrar por ele (substituir o
  `getCurrentOrg()` atual).
- **DB layer (defesa em profundidade)**: habilitar **RLS** por `organization_id`
  usando o claim do JWT (Supabase) — barra vazamento mesmo com bug no app.

## 5. Escala (quando o volume crescer)
- **Banco**: manter o **pooler transaction (6543)** no serverless; subir plano do
  Supabase conforme conexões/CPU; índices por `organization_id`/`event_id` (já
  temos vários). Réplicas de leitura para relatórios pesados.
- **Worker/fila**: hoje cron a cada 1 min processa 25 jobs. Ao crescer: aumentar
  batch + concorrência, ou migrar para fila gerenciada (**Upstash QStash** /
  **Inngest**) para retries, agendamento e paralelismo sem cron.
- **Check-in**: a transação atômica trava só a linha do ticket — baixa contenção,
  escala bem. Picos de porta (muitos scans simultâneos) → bom desde já.
- **QR/PDF**: gerados sob demanda; cachear PNG/PDF (CDN/headers) por token.
- **E-mail/WhatsApp**: respeitar rate limits do provedor; a fila já faz backoff.
- **Edge/CDN**: estáticos via Vercel CDN; páginas públicas (`/q`, `/checkin`)
  com cache curto.
- **Rate limiting** por tenant/IP (Upstash Ratelimit) nas rotas públicas.

## 6. Segurança & conformidade
- Criptografar tokens em repouso (`GhlConnection.access_token`) — usar
  `JWT_SIGNING_KEY`/KMS. Hoje está em claro no banco privado; cifrar antes do
  multi-tenant.
- **LGPD**: export e exclusão de dados por convidado/tenant; retenção; consentimento
  no RSVP/WhatsApp.
- Auditoria de ações sensíveis; rotação de segredos.

## 7. Plano em fases
- **Fase 1 — Tenancy real (base):** resolver `organizationId` da sessão (SSO/auth),
  escopar todas as queries, RLS. Sem isso, nada de multi-tenant.
- **Fase 2 — OAuth do GHL por tenant:** instalar via Marketplace, gravar conexão
  por org criptografada, substituir o PIT compartilhado.
- **Fase 3 — Onboarding + equipe + papéis.**
- **Fase 4 — Billing (Stripe) + limites por plano.**
- **Fase 5 — Escala/observabilidade:** fila gerenciada, rate limiting, métricas,
  custom domains/white-label.

## 8. Decisões a tomar (definem o próximo passo)
1. **Seus clientes são usuários do GHL?** (Caminho A) ou público geral? (Caminho B)
2. **Autenticação**: SSO do GHL, Clerk, Supabase Auth?
3. **Billing**: terá planos pagos (Stripe) já no início?
