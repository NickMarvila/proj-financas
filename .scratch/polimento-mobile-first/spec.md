# Spec: Polimento Mobile-First Completo (FinançasPonto)

**Status:** ready-for-agent

## Problem Statement

Embora o FinançasPonto já possua uma base de navegação móvel (barra superior, barra inferior e drawer lateral), diversas telas e componentes ainda violam diretrizes essenciais da regra `mobile-first.md` e apresentam atritos de usabilidade em telas pequenas (360px–480px):

1. **Faixa de métricas espremida em 360px:** O `.dash-metrics-strip` força 3 colunas em qualquer largura, fazendo rótulos caírem para `9.5px`–`10px` (abaixo do mínimo de `11px`) e truncando valores monetários longos (ex.: `R$ 12.345,67`) com reticências.
2. **Painel de Batidas do Dia fora da visão no celular/tablet retrato:** Em telas de 1 coluna (`< 1100px`), tocar em um dia no calendário ou na lista atualiza o `DayPunchesPanel` lá embaixo da página (fora da dobra), sem feedback imediato ao usuário.
3. **Modais desalinhados do padrão Bottom Sheet:** Apenas o modal de despesas usa `.modal-overlay` / `.modal`. O modal de Feriados (`Ponto`), o modal de Redefinir Senha (`Configurações`) e o `AndroidTimePickerModal` usam estilos inline fixos centralizados com `90vh` em vez de Bottom Sheet com `90dvh` e `env(safe-area-inset-bottom)`.
4. **Seletor de Horário (`AndroidTimePickerModal`) sem arrasto tátil e com alvos pequenos:** O relógio radial só responde a cliques isolados (`onClick`), sem suporte a arrastar o ponteiro com o dedo (`pointer/touch drag`), e os chips de atalho têm altura inferior a `44px`.
5. **Inputs `< 16px` (zoom automático no iOS) e alvos de toque `< 44×44px`:** Seletores como `.admin-collab-select` (`13px`), selects/botões de gestão de usuários (`12px`, `32px` de altura), botões de ação em `DayPunchesPanel` e exclusão de feriados (`28×28px`) estão abaixo dos limites mínimos de toque e tipografia.
6. **Abuso de `style={{...}}` inline e `onMouseEnter`/`onMouseLeave` via JS:** Componentes como `WorkScheduleEditor`, `Login`, `Perfil`, `Configurações`, `Finanças`, `Ponto` e `Dashboard` usam estilos inline que impedem media queries e mantêm estados de hover presos no toque, além de exibirem todos os 7 dias da jornada abertos simultaneamente no celular.
7. **Alertas nativos bloqueantes:** O uso de `alert()` e `window.confirm()` interrompe o fluxo em dispositivos móveis com diálogos nativos destoados da interface.

## Solution

Realizar um polimento Mobile-First completo em todas as telas (`Dashboard`, `Ponto`, `Finanças`, `Histórico`, `Perfil`, `Configurações` e `Login`) e componentes compartilhados:

- **Sistema global de Toasts, Confirm Sheet e Bottom Sheet reutilizável:** Substituir todos os `alert()` por notificações Toast não-bloqueantes e todos os `window.confirm()` por um Bottom Sheet de confirmação no celular (modal centralizado no desktop). Padronizar todos os modais do sistema sobre a mesma estrutura `.modal-overlay` / `.modal` (Bottom Sheet no mobile com `max-height: 90dvh`, `env(safe-area-inset-bottom)`, alça visual superior e fechamento por `Esc`/backdrop).
- **Batidas do Dia em Bottom Sheet abaixo de `1100px`:** Em telas onde `.grid-2` opera em coluna única (`< 1100px`), tocar em um dia no calendário ou na lista de `Dashboard` e `Ponto` abre o `DayPunchesPanel` dentro de um Bottom Sheet deslizante. Em telas `>= 1100px`, o painel permanece renderizado lado a lado na coluna direita.
- **Faixa de métricas em layout `2 + 1` no celular:** No CSS base (`< 480px`), `.dash-metrics-strip` passa a exibir 2 colunas na primeira linha e o 3º card ocupando a largura total (`grid-column: 1 / -1`), garantindo rótulos `>= 11px` e valores monetários completos sem truncamento; a partir de `480px`/`768px`, retorna para 3 colunas.
- **`AndroidTimePickerModal` com arrasto tátil e alvos de 44px:** Transformar o modal em Bottom Sheet no celular, suportar seleção contínua por `Pointer Events` (`onPointerDown`, `onPointerMove`, `onPointerUp`) no mostrador SVG para horas e minutos, e elevar todos os botões de atalho e ações para no mínimo `44×44px`.
- **`WorkScheduleEditor` em acordeão compacto no celular:** No celular, cada dia da semana exibe um cabeçalho compacto com resumo da jornada (ex.: `Seg • 8h 30m • 08:00–12:00, 13:30–18:00`) e botão de alternância rápida Trabalha/Folga (`>= 44px`), expandindo os turnos sob demanda ao tocar para editar. Remover todos os `onMouseEnter`/`onMouseLeave` em JS em favor de classes CSS com `@media (hover: hover)`.
- **Conformidade estrita com `mobile-first.md` em todas as telas:** Todos os `input`, `select` e `textarea` com `font-size: 16px` no celular e `min-height: 44px`; todos os botões e ícones clicáveis com alvo mínimo de `44×44px`; textos de corpo `>= 13px` e rótulos secundários `>= 11px`; nenhum `white-space: nowrap` sem `overflow: hidden; text-overflow: ellipsis`; migração de estilos inline de layout para classes CSS em `index.css`.

## User Stories

1. Como usuário no celular (360px), quero ver os 3 cards de métricas do Dashboard e do Ponto dispostos em formato `2 + 1` (2 no topo e 1 largo abaixo), para que valores como `R$ 12.345,67` e rótulos `>= 11px` apareçam inteiros sem cortar com reticências.
2. Como usuário em telas menores que `1100px`, quero tocar em qualquer dia do calendário ou da lista em `Dashboard` ou `Ponto` e ver as batidas daquele dia abrirem imediatamente em um Bottom Sheet deslizante, para não precisar rolar a página procurando o painel de batidas.
3. Como usuário no desktop (`>= 1100px`), quero continuar vendo o calendário à esquerda e o painel de batidas fixo à direita, aproveitando o espaço horizontal.
4. Como usuário no celular, quero que todos os modais (`Feriados`, `Redefinir Senha`, `Nova/Editar Despesa`, `Selecionar Horário`) abram como Bottom Sheet colados na borda inferior com `max-height: 90dvh`, rolagem interna suave e respeito ao `safe-area-inset-bottom`.
5. Como usuário no celular, quero arrastar o dedo pelo mostrador circular do `AndroidTimePickerModal` para escolher a hora e o minuto continuamente, além de tocar em atalhos de horário com altura confortável (`>= 44px`).
6. Como usuário no iOS/Android, quero que todos os campos de formulário (`input`, `select`, inclusive o seletor de Colaborador do Admin e o seletor de papel de usuário em Configurações) tenham `font-size: 16px` no celular, para que o navegador não dê zoom involuntário ao focar.
7. Como usuário no celular, quero que todos os botões de ação — incluindo editar/excluir batida, excluir feriado, editar/excluir despesa, mostrar/ocultar senha e navegar entre ciclos — tenham área mínima de toque de `44×44px`, evitando toques acidentais.
8. Como usuário editando minha jornada em `Meu Perfil` pelo celular, quero ver os 7 dias da semana em formato de acordeão compacto (mostrando o resumo de horas e intervalos no cabeçalho), podendo expandir apenas o dia que desejo alterar os turnos.
9. Como usuário em `Meu Perfil` no celular, quero que os botões de salvar perfil, salvar jornada, atualizar senha e conectar/sincronizar Gmail ocupem a largura total do card no celular e fiquem alinhados de forma limpa no desktop.
10. Como usuário realizando ações no sistema (sincronizar Gmail, registrar ponto manual, salvar salário/despesa, alterar feriado ou senha), quero receber feedback em Toasts visuais elegantes no lugar de `alert()` nativo do navegador.
11. Como usuário excluindo um registro (batida de ponto, feriado, despesa, desconexão do Gmail ou mudança de permissão), quero confirmar a ação em um Bottom Sheet/modal de confirmação estilizado em vez de `window.confirm()`.
12. Como usuário no `Histórico` e em `Finanças` no celular, quero que os cards de resumo mensal e a lista de despesas fixas distribuam nome, vencimento, valor e botões de ação sem estourar a largura de 360px nem espremer o texto.
13. Como administrador em `Configurações` no celular, quero gerenciar usuários (trocar papel Admin/Funcionário e redefinir senha) e executar a sincronização avançada em lote com controles empilhados de forma legível e alvos de toque de `44px`.
14. Como usuário na tela de `Login`, quero que o formulário use classes CSS padronizadas do tema do aplicativo, respeitando `100dvh`, `safe-area` e inputs de `16px` com botão de mostrar/ocultar senha de `44×44px`.
15. Como mantenedor, quero que todo o CSS siga a arquitetura Mobile-First (regras base para 360px+ e apenas `@media (min-width: 480px | 768px | 1100px)`), sem `@media (max-width: ...)` e sem `onMouseEnter`/`onMouseLeave` manipulando estilos via JavaScript.

## Implementation Decisions

- **Arquitetura CSS Mobile-First (`index.css`):**
  - Base sem `@media` desenhada para `360px+`.
  - Evolução progressiva exclusivamente com `@media (min-width: 480px)`, `@media (min-width: 768px)` e `@media (min-width: 1100px)`.
  - Efeitos de `:hover` restritos ao bloco `@media (hover: hover)`.
  - Remoção de `white-space: nowrap` desprotegidos (adicionando `overflow: hidden; text-overflow: ellipsis` em `.dash-title`, `.dash-subtitle` e similares).
- **Faixa de Métricas (`.dash-metrics-strip`):**
  - No base (`< 480px`): `grid-template-columns: repeat(2, minmax(0, 1fr))` com `.dash-metric-card:nth-child(3) { grid-column: 1 / -1; }`.
  - Tipografia mínima: `.metric-head` com `11px`, `.metric-foot` com `11px`, `.metric-val` com `16px`–`18px` sem cortar valores monetários.
  - Em `@media (min-width: 480px)`: `grid-template-columns: repeat(3, minmax(0, 1fr))` e `.dash-metric-card:nth-child(3) { grid-column: auto; }`.
- **Calendário Mensal (`MonthCalendar`) e Legenda:**
  - Ajustar tipografia e células no base `360px` para melhor legibilidade (`.cal-wd` `>= 10px/11px`, `.cal-day` `12px`, `.cal-sub` e `.cal-badge` otimizados para caber sem estourar os 7 dias).
- **Bottom Sheet de Batidas do Dia (`Dashboard` e `Ponto`):**
  - Abaixo de `1100px`, a coluna direita fixa do `.grid-2` que contém o `DayPunchesPanel` fica oculta; tocar em qualquer dia no `MonthCalendar` (ou item da lista em `Ponto`) abre um Bottom Sheet contendo o `DayPunchesPanel` da data selecionada.
  - Em `>= 1100px`, o `DayPunchesPanel` é exibido inline no card da segunda coluna, exatamente como hoje, e o Bottom Sheet não é acionado.
- **Padronização de Modais e Feedback (`Toast` + `ConfirmDialog`):**
  - Criar um contexto/provider leve de feedback (`useFeedback` / `ToastProvider`) sem dependências externas pesadas, fornecendo `toast.success(...)`, `toast.error(...)`, `toast.info(...)` e `confirm({ title, message, confirmLabel, danger })`.
  - Todos os modais (`Finanças`, `Feriados` em `Ponto`, `Redefinir Senha` em `Configurações`, `AndroidTimePickerModal` e `ConfirmDialog`) utilizam a estrutura `.modal-overlay` + `.modal` com alça superior (`.modal-handle`) no celular, `max-height: 90dvh`, `padding-bottom: calc(20px + env(safe-area-inset-bottom))`, bloqueio de scroll do `body` e fechamento por tecla `Escape` ou clique no backdrop.
- **Aprimoramento do `AndroidTimePickerModal`:**
  - Converter estilos inline para classes CSS em `index.css` sobre `.modal-overlay` / `.modal`.
  - Implementar cálculo de ângulo/distância compartilhado para eventos `onPointerDown`, `onPointerMove` e `onPointerUp` (com `setPointerCapture`) no `<svg>` do relógio, permitindo arrastar o ponteiro suavemente e avançar automaticamente da hora para os minutos ao soltar (`pointerUp`).
  - Chips de atalho (`:00`, `:15`, `:30`, `:45` e horários comerciais) com `min-height: 44px` e `min-width: 44px`.
- **Acordeão no `WorkScheduleEditor` (`Perfil`):**
  - Cada dia da semana possui estado de expansão (no celular, começa colapsado mostrando badge do dia, carga horária calculada, resumo textual dos turnos `08:00–12:00 • 13:30–18:00` e controles de Trabalha/Folga + ícone chevron).
  - Ao tocar no cabeçalho de um dia que trabalha (ou ao ativar "Trabalha"), o card expande os turnos com os botões de Entrada/Saída (`min-height: 44px`).
  - Substituir todos os estilos inline e `onMouseEnter`/`onMouseLeave` por classes CSS.
- **Refinamento de Telas (`Login`, `Perfil`, `Finanças`, `Histórico`, `Configurações`):**
  - `Login`: migrar o objeto `styles` inline para classes CSS em `index.css`, mantendo a animação `framer-motion` e adicionando botão de exibir/ocultar senha (`44×44px`).
  - `Configurações`: na lista de usuários, organizar cada item de usuário para que o seletor de papel (`font-size: 16px`, `min-height: 44px`) e o botão "Senha" (`min-height: 44px`) tenham toque confortável em `360px`.

## Testing Decisions

- **Bom teste / verificação:** Garante que a aplicação compila sem erros de tipos, gera o bundle de produção e cumpre os 5 critérios objetivos da regra `mobile-first.md` nas larguras **360px, 390px, 768px e 1280px**.
- **Seam de verificação:**
  1. `npx tsc -b && npm run build` (zero erros de TypeScript e build Vite limpo).
  2. Auditoria automatizada/estrutural de CSS e JSX + verificação nas larguras `360px`, `390px`, `768px` e `1280px`:
     - Zero rolagem horizontal (`scrollWidth <= innerWidth`).
     - Nenhum `input`/`select`/`textarea` com fonte `< 16px` no mobile.
     - Nenhum alvo de toque interativo `< 44×44px` no mobile.
     - Modais e Bottom Sheets respeitando `90dvh` e `env(safe-area-inset-bottom)`.

## Out of Scope

- Alterações em regras de negócio do backend (cálculo de ponto, ciclo 21–20, compensação de sábados, integração OAuth/Evolution API).
- Mudança da paleta de cores ou identidade visual "Dark Emerald/Slate" existente.
- Criação de aplicativo nativo (React Native / Capacitor).
