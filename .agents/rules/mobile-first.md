---
trigger: always_on
description: Todo trabalho de interface no frontend do FinançasPonto deve ser mobile-first.
---

# Regra: Mobile-First obrigatório (frontend)

Tudo que for criado ou alterado na interface do `frontend/` parte do **celular** e só depois cresce para tablet e desktop. O objetivo é nunca descobrir bug de layout só depois do deploy.

## Como escrever CSS

- O CSS **base** (sem `@media`) é o layout de celular (a partir de 360px). Telas maiores só **adicionam** regras com `@media (min-width: …)`.
- Breakpoints do projeto: `480px` (celular grande), `768px` (tablet: aparece a sidebar), `1100px` (desktop largo: grids de 2 colunas).
- **Não** usar `@media (max-width: …)` para criar layout. Só é aceitável como exceção documentada.
- Preferir classes em `index.css` a `style={{…}}` inline quando o estilo precisa mudar por largura (inline não aceita media query). Estilo inline só para valores dinâmicos (cores por status etc.).
- Grids: `repeat(auto-fit, minmax(min(100%, Npx), 1fr))` ou `minmax(0, 1fr)`; filhos de grid/flex que contêm texto longo precisam de `min-width: 0`.
- Nada de largura fixa em `px` para contêineres (use `max-width` + `width: 100%`). Imagens/SVG: `max-width: 100%`.
- Usar `100dvh` (não `100vh`) e respeitar `env(safe-area-inset-*)` em elementos fixos (bottom nav, modais, drawers).

## Toque e legibilidade

- Alvos de toque (botões, links, itens de navegação) com no mínimo **44×44px** no celular.
- `input`, `select` e `textarea` com **16px** no celular (menos que isso faz o iOS dar zoom ao focar).
- Texto de corpo ≥ 13px; rótulos secundários ≥ 11px. Nada de `white-space: nowrap` sem `overflow: hidden; text-overflow: ellipsis`.
- Modais viram **bottom sheet** no celular (colados embaixo, `max-height: 90dvh`, rolagem interna).
- Não depender de `:hover` para informação ou ação; hover é só realce em `@media (hover: hover)`.

## Checklist antes de dar a tarefa por concluída

Conferir (no navegador, modo responsivo, ou justificar por que não foi possível) nas larguras **360, 390, 768 e 1280px**:

1. Nenhuma rolagem horizontal na página (`document.documentElement.scrollWidth <= innerWidth`).
2. Nenhum texto cortado ou sobreposto; valores monetários longos (ex.: `R$ 12.345,67`) cabem.
3. Menu inferior não cobre o conteúdo (há padding inferior) e todas as rotas são alcançáveis pelo celular.
4. Formulários utilizáveis com o teclado aberto; modais rolam internamente.
5. `npx tsc -b` e o build do Vite passam.

Se não for possível validar visualmente, dizer isso explicitamente na resposta ao usuário em vez de afirmar que "está perfeito no celular".
