package com.financasponto.service;

import com.financasponto.entity.*;
import com.financasponto.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import com.financasponto.utils.CycleUtils;
import com.financasponto.utils.CycleUtils.Cycle;

@Slf4j
@Service
@RequiredArgsConstructor
public class FinanceService {

    private final SalaryConfigRepository salaryConfigRepository;
    private final ExpenseRepository expenseRepository;
    private final MonthlySummaryRepository monthlySummaryRepository;
    private final WorkDayRepository workDayRepository;
    private final com.financasponto.repository.HolidayRepository holidayRepository;

    public SalaryConfig getSalaryConfig(Long userId) {
        return salaryConfigRepository.findFirstByUserIdAndActiveTrueOrderByUpdatedAtDesc(userId)
                .orElse(null);
    }

    @Transactional
    public SalaryConfig saveSalaryConfig(Usuario user, SalaryConfig config) {
        // Desativar configs anteriores deste usuário
        salaryConfigRepository.findFirstByUserIdAndActiveTrueOrderByUpdatedAtDesc(user.getId())
                .ifPresent(old -> {
                    old.setActive(false);
                    salaryConfigRepository.save(old);
                });
        config.setId(null); // sempre cria uma nova versão; nunca sobrescreve config de outro usuário
        config.setUser(user);
        config.setActive(true);
        return salaryConfigRepository.save(config);
    }

    public List<Expense> getActiveExpenses(Long userId) {
        return expenseRepository.findByUserIdAndActiveTrueOrderByNameAsc(userId);
    }

    @Transactional
    public Expense createExpense(Usuario user, Expense expense) {
        expense.setId(null);
        expense.setUser(user);
        return expenseRepository.save(expense);
    }

    @Transactional
    public Expense updateExpense(Usuario user, Long id, Expense expense) {
        findOwnedExpense(user.getId(), id);
        expense.setId(id);
        expense.setUser(user);
        return expenseRepository.save(expense);
    }

    @Transactional
    public void deleteExpense(Long userId, Long id) {
        Expense e = findOwnedExpense(userId, id);
        e.setActive(false);
        expenseRepository.save(e);
    }

    private Expense findOwnedExpense(Long userId, Long id) {
        return expenseRepository.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Despesa não encontrada"));
    }

    @Transactional
    public MonthlySummary recalculateMonthlySummary(Usuario user, int month, int year) {
        Long userId = user.getId();
        int cutDay = user.getFirstDayOfMonth() != null ? user.getFirstDayOfMonth() : 21;
        LocalDate start = CycleUtils.getCycleStart(year, month, cutDay);
        LocalDate end = CycleUtils.getCycleEnd(year, month, cutDay);

        Integer overtimeMinutes = workDayRepository.sumOvertimeMinutesByUserIdAndDateBetween(userId, start, end);
        if (overtimeMinutes == null) overtimeMinutes = 0;

        // Sábados seguem o MÊS CALENDÁRIO (dia 1 ao último dia), NÃO o ciclo 21-20
        boolean worksSaturday = user.getWorkSaturday() == null || 
                (!user.getWorkSaturday().toLowerCase().contains("não") && 
                 !user.getWorkSaturday().toLowerCase().contains("nao") && 
                 !user.getWorkSaturday().toLowerCase().contains("folga") && 
                 !user.getWorkSaturday().trim().isEmpty());

        LocalDate today = LocalDate.now();
        int totalSaturdays = CycleUtils.countSaturdaysInMonth(year, month);
        LocalDate startOfMonth = LocalDate.of(year, month, 1);
        LocalDate endOfMonth = startOfMonth.withDayOfMonth(startOfMonth.lengthOfMonth());
        long workedSaturdays = workDayRepository.countWorkedSaturdaysInCycle(userId, startOfMonth, endOfMonth);

        int requiredSaturdays = 0;
        int missingSaturdays = 0;
        int unworkedSaturdays = 0;
        int compensatedMinutes = 0;
        int grossOvertimeMinutes = overtimeMinutes;

        if (worksSaturday) {
            // Escala 6x1 com compensação: 2 sábados são compensados pelas 8h de seg-qui (+30min/dia)
            // Mês de 4 sábados -> 2 obrigatórios. Mês de 5 sábados -> 3 obrigatórios.
            requiredSaturdays = Math.max(0, totalSaturdays - 2);

            // Sábados que já decorreram no mês até a data de hoje:
            int elapsedSaturdays = 0;
            int holidaySaturdays = 0;
            if (year < today.getYear() || (year == today.getYear() && month < today.getMonthValue())) {
                for (LocalDate d = startOfMonth; !d.isAfter(endOfMonth); d = d.plusDays(1)) {
                    if (d.getDayOfWeek() == java.time.DayOfWeek.SATURDAY) {
                        elapsedSaturdays++;
                        if (holidayRepository.existsByUserIdAndDate(userId, d)) {
                            holidaySaturdays++;
                        }
                    }
                }
            } else if (year == today.getYear() && month == today.getMonthValue()) {
                for (LocalDate d = startOfMonth; !d.isAfter(endOfMonth) && !d.isAfter(today); d = d.plusDays(1)) {
                    if (d.getDayOfWeek() == java.time.DayOfWeek.SATURDAY) {
                        elapsedSaturdays++;
                        if (holidayRepository.existsByUserIdAndDate(userId, d)) {
                            holidaySaturdays++;
                        }
                    }
                }
            } else {
                elapsedSaturdays = 0;
            }

            // Sábados decorridos que o colaborador NÃO trabalhou (feriados não são falta nem exigem trabalho):
            int eligibleSaturdays = Math.max(0, elapsedSaturdays - holidaySaturdays);
            int elapsedUnworkedSaturdays = Math.max(0, eligibleSaturdays - (int) workedSaturdays);

            // As primeiras 2 folgas de sábado do mês são compensadas pela jornada de 8h30 de seg-qui!
            int compensatedSaturdays = Math.min(2, elapsedUnworkedSaturdays);
            compensatedMinutes = compensatedSaturdays * 240;

            // Faltas: apenas sábados já decorridos além das 2 folgas compensadas
            missingSaturdays = Math.max(0, elapsedUnworkedSaturdays - 2);

            // Somente faltas de sábados obrigatórios são debitadas das horas extras!
            // As 2 folgas de sábado já foram pagas pelas 8h30 trabalhadas de seg a qui.
            unworkedSaturdays = elapsedUnworkedSaturdays;
            overtimeMinutes = Math.max(0, overtimeMinutes - (missingSaturdays * 240));
        }

        Cycle currentCycle = CycleUtils.getCurrentCycle(LocalDate.now(), cutDay);
        boolean isFuture = year > currentCycle.year || (year == currentCycle.year && month > currentCycle.month);
        boolean isPastBeforeStart = year < 2026 || (year == 2026 && month < 4); // Sistema iniciou em Abril/2026

        if (isFuture || isPastBeforeStart) {
            return MonthlySummary.builder()
                    .year(year).month(month)
                    .baseSalary(BigDecimal.ZERO)
                    .totalOvertimeMinutes(overtimeMinutes)
                    .grossOvertimeMinutes(grossOvertimeMinutes)
                    .compensatedMinutes(compensatedMinutes)
                    .overtimePay(BigDecimal.ZERO)
                    .totalExpenses(BigDecimal.ZERO)
                    .finalBalance(BigDecimal.ZERO)
                    .missingSaturdays(missingSaturdays)
                    .workedSaturdays((int) workedSaturdays)
                    .totalSaturdays(totalSaturdays)
                    .requiredSaturdays(requiredSaturdays)
                    .build();
        }

        SalaryConfig config = salaryConfigRepository
                .findFirstByUserIdAndActiveTrueOrderByUpdatedAtDesc(userId).orElse(null);

        BigDecimal baseSalary = config != null ? config.getBaseSalary() : BigDecimal.ZERO;

        BigDecimal overtimePay = BigDecimal.ZERO;
        if (config != null && overtimeMinutes != 0) {
            int divisor = user.getMonthlyHoursGoal() != null && user.getMonthlyHoursGoal() > 0 
                    ? user.getMonthlyHoursGoal() 
                    : (config.getMonthlyHoursDivisor() != null ? config.getMonthlyHoursDivisor() : 220);
            BigDecimal hourlyRate = config.getBaseSalary()
                    .divide(BigDecimal.valueOf(divisor), 4, RoundingMode.HALF_UP);
            
            if (overtimeMinutes > 0) {
                BigDecimal rate = BigDecimal.ONE.add(config.getOvertimeRate());
                BigDecimal hours = BigDecimal.valueOf(overtimeMinutes)
                        .divide(BigDecimal.valueOf(60), 4, RoundingMode.HALF_UP);
                overtimePay = hourlyRate.multiply(rate).multiply(hours).setScale(2, RoundingMode.HALF_UP);
            } else {
                BigDecimal hours = BigDecimal.valueOf(overtimeMinutes) // negativo
                        .divide(BigDecimal.valueOf(60), 4, RoundingMode.HALF_UP);
                overtimePay = hourlyRate.multiply(hours).setScale(2, RoundingMode.HALF_UP);
            }
        }

        List<Expense> expenses = expenseRepository.findActiveForMonthByUserId(userId, month, year);
        BigDecimal totalExpenses = expenses.stream()
                .map(Expense::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        // Balanço isolado do ciclo: nada de meses anteriores entra no saldo
        BigDecimal finalBalance = baseSalary.add(overtimePay).subtract(totalExpenses);

        MonthlySummary summary = monthlySummaryRepository.findByUserIdAndMonthAndYear(userId, month, year)
                .orElse(MonthlySummary.builder().user(user).month(month).year(year).build());

        summary.setBaseSalary(baseSalary);
        summary.setTotalOvertimeMinutes(overtimeMinutes);
        summary.setOvertimePay(overtimePay);
        summary.setTotalExpenses(totalExpenses);
        summary.setFinalBalance(finalBalance);
        summary.setMissingSaturdays(missingSaturdays);
        MonthlySummary saved = monthlySummaryRepository.save(summary);
        saved.setWorkedSaturdays((int) workedSaturdays);
        saved.setTotalSaturdays(totalSaturdays);
        saved.setRequiredSaturdays(requiredSaturdays);
        saved.setGrossOvertimeMinutes(grossOvertimeMinutes);
        saved.setCompensatedMinutes(compensatedMinutes);

        return saved;
    }

    public MonthlySummary getSummary(Usuario user, int year, int month) {
        return recalculateMonthlySummary(user, month, year);
    }

    public MonthlySummary getCurrentMonthSummary(Usuario user) {
        int cutDay = user.getFirstDayOfMonth() != null ? user.getFirstDayOfMonth() : 21;
        Cycle cycle = CycleUtils.getCurrentCycle(LocalDate.now(), cutDay);
        return getSummary(user, cycle.year, cycle.month);
    }

    public List<MonthlySummary> getAllSummaries(Long userId) {
        return monthlySummaryRepository.findByUserIdOrderByYearDescMonthDesc(userId);
    }
}
