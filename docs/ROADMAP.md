# Spark Check-in — Roadmap de Features Essenciais

Dez melhorias priorizadas para tornar a ferramenta mais fácil e útil ao
organizador. Ordenadas por relação valor × esforço (as primeiras entregam mais
com menos). Cada item lista o problema que resolve e um esboço de implementação.

| # | Feature | Valor | Esforço |
|---|---------|-------|---------|
| 1 | Busca + filtros na lista de convidados | Alto | Baixo |
| 2 | Detalhe do convidado em Drawer | Alto | Médio |
| 3 | Status de entrega do e-mail por convidado | Alto | Médio |
| 4 | Importação CSV com pré-visualização e deduplicação | Alto | Médio |
| 5 | Exportar relatório (CSV/PDF) do evento | Médio | Baixo |
| 6 | Duplicar evento | Médio | Baixo |
| 7 | Reenvio em massa para "não enviados" | Alto | Baixo |
| 8 | Dashboard de check-in ao vivo (auto-refresh) | Médio | Médio |
| 9 | Vincular contatos do Spark/GHL por tag | Alto | Alto |
| 10 | OAuth do Spark + conexão criptografada | Alto | Alto |

## 1. Busca + filtros na lista de convidados
**Problema:** em eventos grandes fica difícil achar uma pessoa ou ver só quem
falta enviar / fazer check-in.
**Como:** `SearchInput` (nome/e-mail) + filtros por status (QR pendente, enviado,
presente). Filtragem client-side sobre a lista já carregada; sem nova API.

## 2. Detalhe do convidado em Drawer
**Problema:** ações do convidado estão espalhadas; falta uma visão única.
**Como:** clicar na linha abre um `Drawer` (já temos o componente) com dados,
QR grande, histórico de scans, status e ações (reenviar, marcar presença,
remover). Reaproveita `/api/events/:id/report` e logs.

## 3. Status de entrega do e-mail por convidado
**Problema:** hoje sabemos que o convite foi "enfileirado", mas não se o e-mail
saiu de fato (isso é responsabilidade do workflow do GHL).
**Como:** expor o `EmailLog` (queued/sent/error) por convidado e, quando o
worker confirmar, atualizar para "entregue ao Spark". Badge + timestamp.

## 4. Importação CSV com pré-visualização e deduplicação
**Problema:** importar CSV hoje é "às cegas" e pode duplicar convidados.
**Como:** tela de preview mostrando linhas mapeadas, avisos (sem nome, e-mail
inválido) e detecção de duplicados (por e-mail/telefone) antes de confirmar.

## 5. Exportar relatório (CSV/PDF) do evento
**Problema:** o organizador precisa prestar contas pós-evento.
**Como:** botão "Exportar" gera CSV (convidados + status + horário de check-in)
a partir de `/api/events/:id/report`. PDF como fase 2.

## 6. Duplicar evento
**Problema:** recriar eventos recorrentes do zero é trabalhoso.
**Como:** ação "Duplicar" copia configurações (nome, local, capacidade) e gera
novo slug/checker token, sem copiar convidados.

## 7. Reenvio em massa para "não enviados"
**Problema:** após adicionar convidados novos, é chato reenviar um a um.
**Como:** botão "Enviar pendentes (N)" que chama `/api/events/:id/send` apenas
para quem está em `qr_generated`. (O envio individual já existe.)

## 8. Dashboard de check-in ao vivo
**Problema:** na portaria, o organizador quer ver os números subindo em tempo
real.
**Como:** painel com auto-refresh (polling leve a cada ~10s ou revalidate) de
check-ins, capacidade e últimos acessos. Sem WebSocket na V1.

## 9. Vincular contatos do Spark/GHL por tag
**Problema:** convidados de CSV não têm `ghl_contact_id`, então o workflow de
e-mail não dispara para eles.
**Como:** buscar contatos da location por tag e "selecionar todos com a tag X",
gravando `ghl_contact_id` no convidado. Usa o cliente GHL já existente
(`lib/ghl.ts`) com um novo endpoint de busca de contatos.

## 10. OAuth do Spark + conexão criptografada
**Problema:** hoje a credencial é um Private Integration Token em env var,
compartilhado e sem "desconectar".
**Como:** fluxo OAuth do HighLevel gravando `GhlConnection` (token cifrado em
repouso) por organização, com refresh automático. Habilita o botão
"Desconectar" real na tela de Conexão.

---

### Sugestão de ordem de execução
Sprint 1 (rápidas, alto impacto): **1, 7, 5, 6**.
Sprint 2 (visão do convidado): **2, 3, 4**.
Sprint 3 (integração profunda): **9, 10**; **8** encaixa quando útil.
