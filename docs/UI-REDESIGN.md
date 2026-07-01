# Evolução da UI — padrão GoHighLevel (proposta + roadmap)

Objetivo: elevar a experiência a um CRM/painel operacional premium, mantendo a
familiaridade visual do GoHighLevel (cards limpos, bordas suaves, sombras
discretas, abas, cor de destaque, espaçamento consistente).

## 1. Arquitetura visual

- **Shell**: header superior (logo Opta + navegação por abas), conteúdo em
  container `max-w-[1600px]`. Sem ruptura com o layout atual.
- **Página de evento**: abas de topo (Convidados · Envios · Pagamentos ·
  Operação · Configurações · Atividades) e, dentro de cada aba, um _segmented
  control_ para subvisões (ex.: Operação → Painel de check-in / Checker / Sessões / Fluxo).
- **Densidade**: 4 níveis de hierarquia — página → seção (card) → item → meta.

## 2. Design tokens (já existem no `globals.css`, formalizados)

| Token | Uso |
|---|---|
| `--primary` | ação principal, destaque, barras do gráfico |
| `--card` / `--border` | superfícies e divisores |
| `--muted` / `--muted-foreground` | fundos sutis, textos secundários |
| `--success` / `--warning` / `--destructive` | estados |
| `--chart-1..5` | séries de gráfico |
| `--radius` | `xl` cards (16px), `md` inputs/botões |

**Cores semânticas de status** (aplicadas nos módulos):
confirmado = emerald · pendente = amber · ausente/erro = rose · info = sky · pós = violet.

**Motion**: transições de **150–250ms** (`transition`, `duration-200`), `ease-out`.
Hover: `hover:shadow-sm` + leve realce de cor. Clique: escala/opacidade sutil.
Respeitar `prefers-reduced-motion`.

## 3. Componentes reutilizáveis (base a padronizar)

- `Metric` (ícone + valor + label + hint) — **implementado** no painel de check-in.
- `StatusBadge` (variantes por cor semântica).
- `MiniBarChart` (SVG/CSS, sem dependência) — **implementado** inline no painel.
- `SegmentedBar` (comparação proporcional) — **implementado**.
- `DataTable` (cabeçalho, linhas clicáveis, hover, empty/erro).
- `EmptyState` (ícone + título + descrição + CTA) — já existe `empty-state.tsx`.
- `Card` com estados: default / hover (`shadow-sm`) / loading (skeleton) / erro.

## 4. Estados por módulo (padrão)

inicial · vazio (ícone+CTA) · com dados · carregando (skeleton) · sucesso (toast/checkmark)
· erro (mensagem clara + retry) · alerta (amarelo) · confirmação (dialog).

## 5. Módulos

### 5.1 Check-in (Operação → Painel de check-in) — **Fase 1 implementada**
- 4 métricas: Convidados · Confirmados · Pendentes · Ausentes (+ "dentro agora").
- Barra de presença (confirmados/pendentes/ausentes).
- **Gráfico de check-ins por horário** (picos de entrada).
- **Últimos check-ins** (tempo real por refresh).
- **Histórico detalhado**: pessoa (nome+e-mail), data/hora exata, método, porta/operador, status.
- **Drill-down por contato**: e-mail, telefone, QR/ingresso, categoria e **todos os
  eventos de check-in daquele contato**.
- Busca por nome/e-mail/telefone.
- Feedback de scan (verde/amarelo/vermelho) segue no Checker.

### 5.2 Pagamentos (Fase 2)
Cards: Total recebido · Pendente · Em atraso · Confirmados · Recusados.
Lista de pendentes com status individual e ações rápidas (reenviar cobrança,
marcar como pago, ver detalhes). Menos poluição, mais respiro.

### 5.3 Atividades (Fase 3)
Timeline operacional: QR enviado / aberto / check-in / pagamento / edições /
falhas. Filtros por tipo, data e status. Ícone + cor por tipo de evento.

### 5.4 Configurações (Fase 4)
Blocos (accordion/cards): Evento · QR Code · Mensagens · Pagamento · Permissões ·
Aparência. Descrição por bloco, campos agrupados, sem tela-monstro.

### 5.5 Envio de QR Codes (Fase 5)
Motion e microinterações: hover nos cards (elevação), seleção animada de
contatos, feedback ao "Enviar", loading state, confirmação animada, erro claro.
Empty state quando nada foi enviado, com CTA.

## 6. Fluxos

- **Check-in por QR**: scan → `parseQr` extrai token+sig → `POST /api/checkin/validate`
  (sessão de Checker) → registra `CheckInLog` (status, horário, porta) e atualiza
  `Ticket` (checked_in, checkedInAt, checkedInBy) → feedback verde/amarelo/vermelho.
- **Envio de QR**: gerar QR → escolher canal/idioma → enviar → fila → worker →
  status por convidado.
- **Pagamento**: webhook Square → valida assinatura → casa convidado → marca pago →
  dispara ingresso pelo canal.

## 7. Estrutura de dados do check-in (recomendada)

Já existente: `Ticket(checked_in_at, checked_in_by, presence, checkin_count)`,
`CheckInLog(status, scanned_at, gate, checker_user_id, device_info)`.

**Adições recomendadas** (migração a aplicar quando o ambiente de DB estiver estável):

```sql
ALTER TABLE checkin_check_in_logs ADD COLUMN method TEXT NOT NULL DEFAULT 'qr';
-- method: qr | manual | kiosk | other
```

Modelo lógico consolidado por convidado:
`guest_id, event_id, qr_code_id (ticket.token), checkin_status, checked_in_at,
checked_in_by, checkin_method, payment_status, qr_sent_at, qr_last_sent_at,
qr_delivery_status, activity_log`.

Horário salvo em **timestamptz (UTC)** e exibido no fuso local (pt-BR) com
data + hora + segundos.

## 8. Métricas e gráficos sugeridos

- Check-ins por horário (barras) — **feito**.
- Presença (confirmados/pendentes/ausentes) — **feito**.
- Curva de chegada acumulada, entradas por porta (Fluxo — já existe).
- Receita vs. pendente (Pagamentos).

## 9. UX / CRO

- Ação principal sempre destacada (1 por card); secundária discreta.
- Empty states com CTA — reduzem abandono.
- Busca sempre visível nas listas operacionais.
- Feedback imediato (<250ms) em toda ação.
- Números grandes e legíveis nos painéis (leitura de relance).

## 10. Checklist de implementação

- [x] **Fase 1 — Check-in**: painel com métricas, gráfico, últimos, histórico
      detalhado e drill-down por contato.
- [ ] Migração `checkin_method` + gravar método (qr/manual/kiosk) nas rotas.
- [ ] **Fase 2 — Pagamentos**: cards de indicadores + lista de pendentes + ações.
- [ ] **Fase 3 — Atividades**: timeline com filtros.
- [ ] **Fase 4 — Configurações**: blocos/accordions.
- [ ] **Fase 5 — Envio de QR**: motion e microinterações + estados completos.
- [ ] Padronizar `DataTable`, `StatusBadge`, skeletons de loading.

_Fase 1 entregue neste ciclo; as demais seguem incrementais para manter qualidade e estabilidade._
