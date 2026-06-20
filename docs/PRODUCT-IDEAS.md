# Spark Check-in — 10 melhorias de alto impacto

Visão de produto/gestão de eventos. Foco em throughput na porta, confiabilidade
e experiência — sem features de "exportação/relatório". Ordenadas por impacto.

## 1. Checker: buscar convidado por nome (QR perdido)
**Dor:** muita gente chega sem o QR (não achou o e-mail). Hoje só dá pra escanear.
**O quê:** no Checker, um campo de busca por nome/e-mail que lista os convidados
e faz check-in com 1 toque — sem QR.
**Impacto:** elimina a maior fila/atrito da portaria. **Esforço:** baixo (já temos
check-in manual + lista). 

## 2. Cadastro de walk-in na porta
**Dor:** convidados não previstos aparecem; hoje não há fluxo rápido.
**O quê:** botão "Novo na porta" no Checker → nome (e-mail opcional) → gera ticket
e já faz check-in num passo.
**Impacto:** captura todo mundo, sem deixar ninguém de fora. **Esforço:** baixo/médio.

## 3. Modo Autoatendimento (kiosk)
**Dor:** equipe limitada na entrada.
**O quê:** um tablet em modo quiosque onde o convidado escaneia o próprio QR e vê
a tela de boas-vindas (já temos a animação de sucesso) — sem operador.
**Impacto:** dobra/triplica a vazão sem mais staff. **Esforço:** médio (modo de
tela dedicado + trava de PIN).

## 4. Grupos / acompanhantes (+N)
**Dor:** uma inscrição traz várias pessoas (família, mesa, empresa).
**O quê:** convidado com N acompanhantes; check-in do grupo todo ou individual;
contador "3 de 4 presentes".
**Impacto:** reflete a realidade de eventos sociais/corporativos. **Esforço:** médio
(schema: tabela de membros do grupo).

## 5. Categorias de ingresso / VIP + campos personalizados
**Dor:** todo convidado é igual; não há VIP, mesa, credencial.
**O quê:** tiers (VIP/Geral/Imprensa) e campos custom (mesa, lote). Na tela de
sucesso do Checker, **cor/realce por tier** (ex.: VIP dourado) para a equipe
direcionar na hora.
**Impacto:** operação premium e segmentada. **Esforço:** médio.

## 6. Desfazer check-in + correção com auditoria
**Dor:** equipe marca presença errada e não há como reverter com segurança.
**O quê:** "Desfazer último check-in" / reverter por convidado, com log de quem
fez o quê e quando.
**Impacto:** confiança operacional e dados corretos. **Esforço:** baixo/médio
(transação reversa + log).

## 7. Painel ao vivo (tela de operação)
**Dor:** o organizador quer ver o evento "respirando" num telão.
**O quê:** tela cheia com presentes/capacidade, **taxa de chegada por minuto**,
últimos a entrar e % de comparecimento — atualização em tempo real.
**Impacto:** decisão na hora (abrir mais portas, alertar). **Esforço:** médio
(reaproveita o "Ao vivo").

## 8. Capacidade por sessão / horário
**Dor:** eventos com várias sessões (palestras, turnos) só têm capacidade total.
**O quê:** sessões dentro do evento, cada uma com capacidade e ocupação ao vivo;
o check-in conta na sessão certa.
**Impacto:** habilita conferências, workshops, day-use. **Esforço:** médio/alto.

## 9. Checker offline (PWA) — resiliência de Wi-Fi
**Dor:** Wi-Fi de salão de festas/venue é ruim; sem rede, a porta trava.
**O quê:** Checker como PWA que valida e enfileira scans **localmente** e
sincroniza quando a rede volta (com resolução de duplicidade).
**Impacto:** porta nunca para — talvez o ganho de confiabilidade mais alto.
**Esforço:** alto (service worker + sync + validação local assinada).

## 10. Confirmação do convidado (RSVP) + lembretes e boas-vindas
**Dor:** no-show alto; convidado não confirma nem é lembrado.
**O quê:** RSVP na página do ingresso (Confirmo/Não vou); lembrete automático
antes do evento e mensagem "Você está confirmado/Bem-vindo" no check-in
(via GHL/WhatsApp); follow-up de no-show.
**Impacto:** sobe a taxa de comparecimento e engajamento. **Esforço:** médio
(reaproveita tags GHL + fila).

---

## Sugestão de sequência
- **Sprint 1 (porta mais rápida, baixo esforço):** 1, 2, 6.
- **Sprint 2 (escala/experiência):** 3, 7, 4.
- **Sprint 3 (eventos complexos/resiliência):** 5, 8, 10, 9.

> Quase todas reaproveitam o que já existe (check-in atômico, fila/worker,
> animação de sucesso, tags GHL), então o custo incremental é baixo para o valor.
