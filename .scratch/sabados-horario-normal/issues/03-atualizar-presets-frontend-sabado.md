# 03: Predefinição da Escala 6x1 Compensada e Exibição Transparente no Frontend

**What to build:**
Na interface de usuário:
1. No `WorkScheduleEditor`:
   - Incluir o preset oficial: **"Escala 6x1 Compensada"** (Seg-Qui 8h30, Sex 8h, Sáb 4h, Dom Folga).
   - Exibir nota explicativa de fácil leitura: *"Na escala 6x1 compensada, os 30 min extras diários de Seg-Qui (8h/mês) compensam 2 sábados de folga. Você precisa cumprir 2 sábados (ou 3 em meses com 5 sábados). Se trabalhar mais sábados, as horas extras da semana vêm diretamente no pagamento."*
2. Em `Financas.tsx` (resumo mensal):
   - Detalhar no card de sábados:
     - Total de sábados no mês (4 ou 5)
     - Sábados trabalhados (horas normais)
     - Sábados de folga compensada (até 2)
     - Sábados faltantes (se houver, com desconto de 4h)
     - Horas extras semanais liberadas para pagamento.

**Blocked by:** 01: Regra de Sábados e Liquidação de Horas Extras Semanais no Fechamento.

**Status:** completed

- [x] Adicionar botão preset "Escala 6x1 Compensada" no `WorkScheduleEditor.tsx`.
- [x] Adicionar banner/dica explicativa no editor de jornada.
- [x] Atualizar cards de detalhamento de folha em `Financas.tsx` e `Dashboard.tsx` com a contagem transparente de sábados.
