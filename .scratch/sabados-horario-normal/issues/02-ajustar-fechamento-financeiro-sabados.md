# 02: Garantir Sábado com Horas Normais e Apuração Correta no Ponto Diário

**What to build:**
Assegurar no `TimeRecordService` que:
1. O sábado na escala 6x1 é tratado como dia normal de 4 horas contratuais (08:00 às 12:00).
2. O comparecimento no sábado dentro do expediente (08:00 às 12:00) registra 4 horas normais trabalhadas (`workedMinutes = 240`, `overtimeMinutes = 0`), e não como hora extra no próprio sábado, pois as horas extras que serão pagas no contracheque são as horas extras acumuladas de segunda a quinta que deixaram de ser consumidas para folga.
3. Batidas que ultrapassarem as 12:00 no sábado continuam gerando horas extras do excesso de jornada.

**Blocked by:** 01: Regra de Sábados e Liquidação de Horas Extras Semanais no Fechamento.

**Status:** completed

- [x] Confirmar que sábado contabiliza 4 horas normais de contrato no `TimeRecordService`.
- [x] Garantir que batidas além das 12:00 no sábado computem hora extra por excesso diário.
- [x] Validar a gravação correta de `WorkDay` para sábados trabalhados com `isSaturday = true` e `workedMinutes = 240`.
