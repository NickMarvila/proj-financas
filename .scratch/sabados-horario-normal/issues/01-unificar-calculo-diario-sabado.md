# 01: Regra de Sábados e Liquidação de Horas Extras Semanais no Fechamento

**What to build:**
Ajustar o cálculo de fechamento mensal (`FinanceService.recalculateMonthlySummary`) para aplicar a compensação da escala 6x1:
- Cada sábado não trabalhado (`unworkedSaturdays`) absorve 240 minutos (4h) da compensação acumulada durante a semana.
- Quando o colaborador trabalha 2 sábados em mês de 4 (folgando 2), as 8h extras da semana compensam exatamente as 2 folgas (`missingSaturdays = 0`, salário base integral pago).
- Se o colaborador trabalhar mais sábados que a cota mínima (ex: 3 ou 4 sábados), como os sábados trabalhados são horas normais de contrato (4h), a compensação da semana não precisa ser consumida e **as horas extras da semana vêm diretamente no contracheque como extras pagas** (+4h ou +8h).
- Se o colaborador trabalhar apenas 1 sábado em mês de 4 (faltando a 1 sábado obrigatório), desconta 4h no contracheque.
- Em meses com 5 sábados e 3 sábados trabalhados, as 2h extras da 5ª semana são liberadas e pagas como extras.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] Implementar cálculo de `unworkedSaturdays = Math.max(0, totalSaturdays - (int) workedSaturdays)`.
- [ ] Implementar cálculo de `requiredSaturdays = Math.max(0, totalSaturdays - 2)`.
- [ ] Implementar `missingSaturdays = Math.max(0, requiredSaturdays - (int) workedSaturdays)`.
- [ ] Ajustar `overtimeMinutes` subtraindo apenas os minutos correspondentes aos sábados de folga (`unworkedSaturdays * 240`), liberando automaticamente as horas extras da semana quando o sábado é trabalhado.
- [ ] Testar todos os 5 cenários com assertivas numéricas exatas.
