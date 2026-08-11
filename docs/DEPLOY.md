# Deploy na Vercel — Spark Check-in

O projeto já está pronto para deploy (`build` roda `prisma generate && next build`).
Há dois caminhos; o **A** é o recomendado por ser turnkey e dar auto-deploy a
cada push.

## A) Conectar o repositório no painel da Vercel (recomendado)

1. https://vercel.com/new → **Import Git Repository** →
   `gabrielspark23/spark-qrcode-checker`.
2. Framework: **Next.js** (autodetectado). Branch de produção: defina a branch
   atual (`claude/exciting-volta-3tzti6`) ou faça merge para `main` antes.
3. **Environment Variables** (Production + Preview) — ver tabela abaixo.
4. **Deploy**. Ao final, copie o domínio gerado e ajuste `APP_BASE_URL` para ele
   (redeploy para aplicar — a URL entra dentro do QR Code).

## B) Deploy por CLI (eu executo, se me passar um token)

Requer um **Vercel Access Token** (vercel.com → Account Settings → Tokens).
Com o token, eu rodo daqui:

```bash
npx vercel --token=$VERCEL_TOKEN --yes        # cria/linka o projeto
npx vercel env add ...                         # cada variável
npx vercel --prod --token=$VERCEL_TOKEN        # deploy de produção
```

## Variáveis de ambiente (Production)

| Variável | Valor |
|----------|-------|
| `DATABASE_URL` | pooler do Supabase (porta 6543, `?pgbouncer=true`) — ver `.env.example` |
| `DIRECT_URL` | conexão direta do Supabase (porta 5432) |
| `JWT_SIGNING_KEY` | 32 bytes aleatórios (`openssl rand -hex 32`) |
| `TICKET_TOKEN_SECRET` | 32 bytes aleatórios — **não mudar depois**, invalida QRs já emitidos |
| `APP_BASE_URL` | domínio público da Vercel |
| `EMAIL_PROVIDER` / `EMAIL_PROVIDER_KEY` / `EMAIL_FROM` | Etapa 3 (Resend) |
| `ADMIN_EMBED_SECRET` | segredo da trava do painel (`openssl rand -hex 32`) — ver abaixo |
| `PUBLIC_REDIRECT_URL` | destino para acesso externo / fallback do `/pay` (nunca o painel) |
| `SQUARE_GENERAL_CHECKOUT_URL` | checkout geral do Square (fallback do `/pay`) |
| `SQUARE_APPLICATION_ID` | id público do app Square — necessário para a modal `/checkout` (ver `docs/WORDPRESS-CHECKOUT.md`) |
| `CRM_FRAME_ANCESTORS` | domínios do CRM que podem embutir o app (CSP) |

> A senha do banco (Supabase → Project Settings → Database) não é acessível por
> aqui — é a única peça que precisa vir do 👤 Time para montar a `DATABASE_URL`.

## Trava do painel (acesso só pelo CRM)

O painel do organizador (dashboard + APIs de criação de eventos/gestão) fica
**aberto** enquanto `ADMIN_EMBED_SECRET` não estiver definido — mesmo
comportamento de antes. Para **ligar a trava** (bloquear acesso externo direto
na URL) sem se trancar para fora:

1. Defina `ADMIN_EMBED_SECRET` (ex.: `openssl rand -hex 32`) e
   `PUBLIC_REDIRECT_URL` nas envs da Vercel e faça redeploy.
2. No GHL, ajuste o **link do menu/iframe** que abre o app para incluir o
   segredo: `https://eventos.optafinance.com/?k=<ADMIN_EMBED_SECRET>`. No
   primeiro acesso o app grava um cookie de sessão de embed e remove o `?k` da
   URL; as navegações seguintes usam o cookie.
3. Confira: abrir a URL base **sem** o `?k` (fora do CRM) deve redirecionar para
   `PUBLIC_REDIRECT_URL`, e `POST /api/events` sem o cookie deve responder 403.

> O cookie de embed é `SameSite=None; Secure` (obrigatório para ser enviado
> dentro do iframe de outro domínio). Se o navegador do usuário bloquear cookies
> de terceiros, o embed pode não persistir — nesse caso, mantenha o `?k` no link
> do menu como fallback.

## Link de pagamento (`/pay`)

O redirect de submit do formulário aponta para
`…/pay?email={{contact.email}}&agenda=<evento>`. Quando o `/pay` não consegue
montar o checkout personalizado (evento não bate pela agenda, sem preço no
evento, ou Square não configurado), ele agora redireciona para
`SQUARE_GENERAL_CHECKOUT_URL` (ou `PUBLIC_REDIRECT_URL`) — **nunca** para o
painel. O motivo de cada falha fica registrado em `WebhookLog` (fonte `pay`,
status `fail`) para diagnóstico.

## Migrations em produção

As tabelas `checkin_*` já foram aplicadas no Supabase Sparkleads OS. Para futuras
migrations, rode localmente com `DIRECT_URL` apontando para produção:

```bash
DIRECT_URL="...:5432/postgres" npx prisma migrate deploy
```
