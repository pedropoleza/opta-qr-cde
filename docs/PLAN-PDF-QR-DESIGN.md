# Plano — Evolução do design dos PDFs e do QR (ingresso, crachá, certificado)

Transformar os artefatos visuais (ingresso/QR, crachá, certificado) num **estúdio
de design** configurável pelo organizador: efeitos no cabeçalho (halftone, barras,
gradiente, ondas), fundos variados, presets profissionais e uma **arte especial
automática para VIPs**.

## 1. Onde aplica
- **Ingresso/QR** — PDF (`ticket-pdf`) e página pública `/q/[token]`.
- **Crachá** — PDF (`badge-pdf`).
- **Certificado** — PDF (`certificate-pdf`).

## 2. Modelo de configuração (estende `TicketConfig`)
- `headerEffect`: `none | bars | halftone | gradient | waves` — efeito decorativo
  na barra superior.
- `headerEffectColor?`: cor de realce do efeito (default = mistura do brandColor).
- `background`: `plain | dots | grid | gradient | halftone-soft` — textura do corpo.
- `accentStyle`: `flat | gradient` — preenchimento de realces/botões.
- `vipVariant`: ativa a **arte VIP** automática para convidados marcados VIP
  (cores/efeitos próprios, selo VIP).
- (mantém) `preset`, `brandColor`, `logoUrl`, textos e toggles atuais.

## 3. Motor de efeitos (PDF)
`@react-pdf/renderer` suporta **Svg** (Rect, Circle, Path, LinearGradient). Um
componente `HeaderDecoration({ effect, color, w, h })` desenha:
- **bars** — barras diagonais translúcidas.
- **halftone** — grade de círculos com opacidade decrescente.
- **gradient** — `LinearGradient` no fundo da barra.
- **waves** — `Path` ondulado na base do cabeçalho.
Renderizado em camada absoluta atrás do título (o conteúdo fica por cima).

## 4. Motor de efeitos (web `/q`)
Em HTML/CSS é mais simples: gradientes, `radial-gradient` para dots/halftone,
`mask`/SVG inline para ondas. Mesmo vocabulário de `headerEffect`/`background`.

## 5. Arte VIP (automática)
Quando o convidado é VIP:
- **Crachá**: tema escuro + dourado, selo "⭐ VIP", efeito halftone no topo.
- **Ingresso/QR (PDF e /q)**: cabeçalho com realce dourado + efeito, faixa "VIP".
- Aplicada **sem configuração** (herda a marca, troca a paleta para a variante VIP),
  com opção de desligar via `vipVariant=false`.

## 6. Editor (aba Envios → Modelo do ingresso)
Estende o `ticket-template-editor`:
- Seletor visual de **efeito de cabeçalho** (miniaturas).
- Seletor de **fundo**.
- Switch **arte VIP**.
- Pré-visualização ao vivo (já existe preview do modelo).

## 7. Presets prontos (1 clique)
Pacotes que setam efeito+fundo+cores de uma vez: **Minimal**, **Bold**,
**Halftone**, **Gala (VIP dark)**, **Festival (gradiente)**.

## 8. Fases de entrega
- **F1 — Arte VIP + motor de efeitos (bars/halftone) no crachá e no ingresso.**
  *(entrega o pedido imediato e cria a base reutilizável)*
- **F2 — `headerEffect` + `background` configuráveis no editor**, aplicados ao
  ingresso (PDF + /q).
- **F3 — Presets prontos** + efeitos extras (gradient/waves) + certificado.
- **F4 — Polimento**: cache de PNG/PDF por token, fontes, acessibilidade de contraste.
