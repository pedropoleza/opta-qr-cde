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

> A senha do banco (Supabase → Project Settings → Database) não é acessível por
> aqui — é a única peça que precisa vir do 👤 Time para montar a `DATABASE_URL`.

## Migrations em produção

As tabelas `checkin_*` já foram aplicadas no Supabase Sparkleads OS. Para futuras
migrations, rode localmente com `DIRECT_URL` apontando para produção:

```bash
DIRECT_URL="...:5432/postgres" npx prisma migrate deploy
```
