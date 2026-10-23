# 02: Dashboard e Ponto Mobile-First (Métricas 2+1, Calendário e Batidas em Bottom Sheet)

**What to build:** polir as telas de `Dashboard` e `Ponto` (incluindo `MonthCalendar` e `DayPunchesPanel`) para seguir rigorosamente a regra `mobile-first.md`: faixa de métricas em layout `2 + 1` no celular (`< 480px`) sem cortar valores monetários nem usar fontes `< 11px`, abertura das Batidas do Dia (`DayPunchesPanel`) em um Bottom Sheet ao tocar em um dia quando a tela tiver `< 1100px` (mantendo o painel fixo ao lado em `>= 1100px`), e conversão do Modal de Feriados para Bottom Sheet com alvos de toque `>= 44×44px` e inputs `16px`.

**Blocked by:** 01: Sistema de Feedback Mobile-First (Toasts, Confirm Sheet e Base de Bottom Sheet).

**Status:** completed

- [x] No celular (`< 480px`), `.dash-metrics-strip` exibe 2 cards na primeira linha e o 3º card ocupando a largura total abaixo (`2 + 1`), voltando a 3 colunas em `>= 480px`; rótulos têm no mínimo `11px` e valores como `R$ 12.345,67` não sofrem truncamento.
- [x] Em telas `< 1100px` (layout de 1 coluna), tocar em qualquer dia no `MonthCalendar` ou na lista de dias em `Dashboard` e `Ponto` abre o `DayPunchesPanel` dentro de um Bottom Sheet (`max-height: 90dvh`, `safe-area-inset-bottom`); em `>= 1100px`, o `DayPunchesPanel` permanece fixo na coluna lateral direita.
- [x] O seletor de Colaborador (`.admin-collab-select`) e todos os inputs/selects de `Dashboard`, `Ponto` e `DayPunchesPanel` possuem `font-size: 16px` e `min-height: 44px` no celular.
- [x] Todos os botões de ação (sincronizar, navegação de ciclo, alternar Calendário/Lista, Feriados, Nova Batida, editar/excluir batida e excluir feriado) possuem área de toque mínima de `44×44px` no celular.
- [x] O Modal de Gestão de Feriados em `Ponto` utiliza a estrutura padronizada de Bottom Sheet no celular (`.modal-overlay` / `.modal`) sem estilos inline fixos.
- [x] Títulos com `white-space: nowrap` (como `.dash-title` e `.dash-subtitle`) incluem `overflow: hidden; text-overflow: ellipsis`.
- [x] Zero rolagem horizontal em `360px`, `390px`, `768px` e `1280px`, e `npx tsc -b && npm run build` passa sem erros.
