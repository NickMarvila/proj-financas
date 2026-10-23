# 03: TimePicker com Drag Tátil e Editor de Jornada em Acordeão (Perfil)

**What to build:** transformar o `AndroidTimePickerModal` em um Bottom Sheet no celular com suporte a arrastar o dedo continuamente (`Pointer Events`) pelo mostrador circular de horas e minutos e atalhos com `>= 44×44px`; redesenhar o `WorkScheduleEditor` como um acordeão compacto no celular (exibindo o resumo do dia no cabeçalho e expandindo os turnos ao tocar) sem manipuladores `onMouseEnter`/`onMouseLeave` inline; e polir a página `Meu Perfil` com classes CSS mobile-first e botões de largura total no celular.

**Blocked by:** 01: Sistema de Feedback Mobile-First (Toasts, Confirm Sheet e Base de Bottom Sheet).

**Status:** completed

- [x] `AndroidTimePickerModal` abre como Bottom Sheet no celular (`< 768px`) com `max-height: 90dvh` e `env(safe-area-inset-bottom)`.
- [x] O mostrador SVG do `AndroidTimePickerModal` suporta `onPointerDown`, `onPointerMove` e `onPointerUp` (arrasto contínuo com o dedo ou mouse) para selecionar horas (anéis interno e externo) e minutos, avançando automaticamente de hora para minuto ao soltar o toque.
- [x] Todos os botões de atalho de minuto (`:00`, `:15`, `:30`, `:45`), horários comerciais rápidos e botão de fechar do `AndroidTimePickerModal` têm alvo de toque `>= 44×44px` no celular.
- [x] No `WorkScheduleEditor`, cada dia da semana funciona como item de acordeão: exibe cabeçalho compacto com badge do dia, carga horária diária, resumo dos turnos (ex.: `08:00–12:00 • 13:30–18:00`) e controles `Trabalha`/`Folga` (`>= 44px`), expandindo os turnos sob demanda para edição.
- [x] Nenhum uso de `onMouseEnter`/`onMouseLeave` mutando `.style` via JS permanece no `WorkScheduleEditor`; realces de hover usam exclusivamente `@media (hover: hover)` em `index.css`.
- [x] Na página `Meu Perfil`, grids e botões de ação principal ("Salvar Dados Pessoais", "Salvar Jornada", "Atualizar Senha", "Conectar Gmail", "Sincronizar Novos E-mails Agora") ocupam `width: 100%` no celular e ajustam-se em telas maiores via classes CSS.
- [x] Zero rolagem horizontal em `360px`, `390px`, `768px` e `1280px`, e `npx tsc -b && npm run build` passa sem erros.
