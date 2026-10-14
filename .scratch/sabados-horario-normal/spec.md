# Especificação Técnica: Escala 6x1 com Sábados Compensados

## Problem Statement

No modelo de contratação do colaborador (Escala 6x1 com jornada semanal de 44 horas):
1. O sábado é um dia normal de trabalho da escala com 4 horas de expediente (08:00 às 12:00).
2. Existe um acordo de compensação onde, de segunda a quinta-feira, o colaborador faz 30 minutos a mais por dia (jornada de 8h30), e na sexta-feira cumpre o horário normal (8h00), gerando 2 horas a mais por semana.
3. Em 4 semanas, essas 2 horas semanais acumulam 8 horas, que compensam a folga em **2 sábados do mês de 4 horas cada**.
4. Dessa forma, a obrigação mensal de presença aos sábados é:
   - Mês com 4 sábados: obrigatório trabalhar **2 sábados** (2 são folgas compensadas).
   - Mês com 5 sábados: obrigatório trabalhar **3 sábados** (2 são folgas compensadas).
5. Esclarecimento fundamental sobre sábados adicionais trabalhados:
   - Caso o colaborador trabalhe mais sábados do que a meta obrigatória (ex: trabalhar 3 ou 4 sábados em um mês de 4 sábados), as 4 horas de cada sábado trabalhado entram como **horas normais** (já que o contrato é 6x1).
   - Como o colaborador trabalhou no sábado em vez de folgar, as 30 minutos a mais trabalhados diariamente durante a semana não precisam ser consumidos para compensar folga, e por isso **as horas extras da semana vêm diretamente no contracheque como horas extras pagas**.
6. Faltas em sábados obrigatórios:
   - Se o colaborador faltar a um sábado obrigatório (ex: trabalhar apenas 1 sábado em mês de 4), haverá desconto de 4 horas por sábado faltante no contracheque, mantendo-se o cômputo regular das horas extras realizadas durante a semana.
7. Mês com 5 sábados:
   - As 5 semanas geram 10 horas de compensação semanal. Como apenas 8 horas são necessárias para compensar os 2 sábados de folga, as 2 horas restantes da 5ª semana são creditadas como horas extras e pagas normalmente.

## Solution

Ajustar a lógica do cálculo mensal (`FinanceService`) e de horas diárias (`TimeRecordService`) para refletir com exatidão a mecânica da compensação 6x1:
- **Jornada de Sábado**: 4 horas contratuais (08:00 às 12:00). Cada sábado trabalhado pontua 4 horas normais de trabalho. Batidas após 12h no sábado geram horas extras.
- **Apuração de Horas da Semana**: Seg-Qui registram os +30 min no saldo de horas extras diárias (`overtimeMinutes`).
- **Fechamento Mensal**:
  - `totalSaturdays`: quantidade de sábados no mês civil (4 ou 5).
  - `workedSaturdays`: sábados com expediente trabalhado no mês.
  - `unworkedSaturdays = totalSaturdays - workedSaturdays`.
  - `requiredSaturdays = Math.max(0, totalSaturdays - 2)`.
  - **Faltas obrigatórias**: se `unworkedSaturdays > 2`, `missingSaturdays = unworkedSaturdays - 2`. Desconta `missingSaturdays * 240 minutos` no salário.
  - **Sábados trabalhados acima da meta (3º ou 4º sábado)**:
    - O sábado conta como horas normais.
    - Como o sábado foi trabalhado, a compensação da semana não é consumida por aquele sábado de folga, liberando as respectivas 4 horas extras da semana para serem pagas no fechamento.
    - Em fórmula direta no fechamento:
      `ajusteSabadosMinutos = unworkedSaturdays * 240;`
      `horasExtrasLiquidas = totalOvertimeSemana - ajusteSabadosMinutos;`
      - Trabalhou 2 sábados em mês de 4 (2 folgas): 480 min da semana - 480 min (2 folgas compensadas) = 0h extra a pagar (salário base integral).
      - Trabalhou 3 sábados em mês de 4 (1 folga): 480 min da semana - 240 min (1 folga compensada) = +240 min (+4h) pagas como extra da semana!
      - Trabalhou 4 sábados em mês de 4 (0 folgas): 480 min da semana - 0 min = +480 min (+8h) pagas como extra da semana!
      - Trabalhou 1 sábado em mês de 4 (3 folgas): 480 min da semana - 720 min = -240 min (-4h) descontadas no contracheque!
      - Trabalhou 3 sábados em mês de 5 (2 folgas): 600 min da semana - 480 min (2 folgas compensadas) = +120 min (+2h) pagas como extra da 5ª semana!

## User Stories

1. Como colaborador 6x1, quando eu cumprir 2 sábados em um mês de 4 sábados, quero receber meu salário base integral sem desconto de sábados e sem falsos apontamentos de faltas.
2. Como colaborador 6x1, quando eu trabalhar 3 ou 4 sábados no mês, quero que as 4 horas desses sábados sejam registradas como horas normais, e que as horas extras equivalentes que cumpri durante a semana venham no contracheque como horas extras pagas.
3. Como colaborador, se eu faltar a um sábado obrigatório (ex: comparecer a apenas 1 sábado em mês de 4), quero que sejam descontadas exatamente 4 horas daquele sábado não trabalhado, sem perder o registro das horas feitas na semana.
4. Como colaborador, em meses com 5 sábados, quero trabalhar 3 sábados e receber as 2 horas adicionais feitas na semana como horas extras pagas.
5. Como colaborador, quero poder comparecer a quaisquer sábados do mês para cumprir a meta obrigatória (ex: 1º e 3º, 2º e 4º, etc.), sem amarração a datas pré-fixadas.
6. Como colaborador, na tela Meu Perfil, quero poder carregar o preset "6x1 Compensado" preenchendo Seg-Qui 8h30, Sex 8h e Sáb 4h.
7. Como gestor financeiro, quero ver no fechamento de folha a discriminação detalhada: sábados do mês, sábados trabalhados, folgas compensadas e horas extras liberadas para pagamento.

## Implementation Decisions

### 1. Módulo Financeiro (`FinanceService.java`)
- O fechamento mensal passa a adotar a fórmula de compensação 6x1:
  - `int totalSaturdays = CycleUtils.countSaturdaysInMonth(year, month);`
  - `long workedSaturdays = workDayRepository.countWorkedSaturdaysInCycle(userId, startOfMonth, endOfMonth);`
  - `int unworkedSaturdays = Math.max(0, totalSaturdays - (int) workedSaturdays);`
  - `int requiredSaturdays = Math.max(0, totalSaturdays - 2);`
  - `int missingSaturdays = Math.max(0, requiredSaturdays - (int) workedSaturdays);`
  - Ajuste no saldo de horas extras:
    `overtimeMinutes -= (unworkedSaturdays * 240);`
- Sábados trabalhados são computados com horas normais pelo `TimeRecordService`, e as horas extras da semana são liberadas para pagamento quando o colaborador comparece aos sábados adicionais.

### 2. Módulo de Ponto Diário (`TimeRecordService.java`)
- Sábado tem jornada normal de 4 horas (`saturdayContractHours = 4`).
- Batidas de sábado entre 08:00 e 12:00 contabilizam 4 horas normais de contrato (sem hora extra).
- Batidas que ultrapassarem as 12:00 no sábado continuam gerando hora extra diária normalmente.

### 3. Interface do Usuário (`WorkScheduleEditor.tsx` e `Financas.tsx`)
- Preset oficial no `WorkScheduleEditor`: **"Escala 6x1 Compensada"** (Seg-Qui 8h30, Sex 8h, Sáb 4h, Dom Folga).
- Dica visual explicando a compensação de 2 sábados de folga.
- Discriminação clara em `Financas.tsx` dos sábados cumpridos e eventuais faltas ou extras liberadas.

## Testing Decisions

- Testar o fechamento de folha com os 5 cenários exatos:
  - Cenário 1: 4 sábados no mês, 2 trabalhados -> zero faltas, zero extra residual.
  - Cenário 2: 4 sábados no mês, 3 trabalhados -> zero faltas, +4h extras pagas da semana.
  - Cenário 3: 4 sábados no mês, 4 trabalhados -> zero faltas, +8h extras pagas da semana.
  - Cenário 4: 4 sábados no mês, 1 trabalhado -> 1 falta (desconto 4h).
  - Cenário 5: 5 sábados no mês, 3 trabalhados -> zero faltas, +2h extras pagas da 5ª semana.

## Out of Scope
- Alterações em contratos de escala 12x36 ou 5x2 (o escopo é a escala 6x1 compensada).
