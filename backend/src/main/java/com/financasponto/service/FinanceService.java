package com.financasponto.service;

import com.financasponto.entity.*;
import com.financasponto.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

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

    public SalaryConfig getSalaryConfig() {
        return salaryConfigRepository.findFirstByActiveTrueOrderByUpdatedAtDesc()
                .orElse(null);
    }

    @Transactional
    public SalaryConfig saveSalaryConfig(SalaryConfig config) {
        // Desativar configs anteriores
        salaryConfigRepository.findFirstByActiveTrueOrderByUpdatedAtDesc()
                .ifPresent(old -> {
                    old.setActive(false);
                    salaryConfigRepository.save(old);
                });
        config.setActive(true);
        return salaryConfigRepository.save(config);
    }

    public List<Expense> getActiveExpenses() {
        return expenseRepository.findByActiveTrueOrderByNameAsc();
    }

    @Transactional
    public Expense saveExpense(Expense expense) {
        return expenseRepository.save(expense);
    }

    @Transactional
    public void deleteExpense(Long id) {
        expenseRepository.findById(id).ifPresent(e -> {
            e.setActive(false);
            expenseRepository.save(e);
        });
    }

    @Transactional
    public MonthlySummary recalculateMonthlySummary(int month, int year) {
        LocalDate start = CycleUtils.getCycleStart(year, month);
        LocalDate end = CycleUtils.getCycleEnd(year, month);

        Integer overtimeMinutes = workDayRepository.sumOvertimeMinutesByDateBetween(start, end);
        if (overtimeMinutes == null) overtimeMinutes = 0;

        // Sábados seguem o MÊS CALENDÁRIO (dia 1 ao último dia), NÃO o ciclo 21-20
        int totalSaturdays = CycleUtils.countSaturdaysInMonth(year, month);
        LocalDate startOfMonth = LocalDate.of(year, month, 1);
        LocalDate endOfMonth = startOfMonth.withDayOfMonth(startOfMonth.lengthOfMonth());
        long workedSaturdays = workDayRepository.countWorkedSaturdaysInCycle(startOfMonth, endOfMonth);
        
        int missingSaturdays = totalSaturdays - (int) workedSaturdays;
        if (missingSaturdays < 0) missingSaturdays = 0;
        
        overtimeMinutes -= (missingSaturdays * 240); // 4 horas por sábado não trabalhado

        Cycle currentCycle = CycleUtils.getCurrentCycle(LocalDate.now());
        boolean isFuture = year > currentCycle.year || (year == currentCycle.year && month > currentCycle.month);
        boolean isPastBeforeStart = year < 2026 || (year == 2026 && month < 4); // Sistema iniciou em Abril/2026

        if (isFuture || isPastBeforeStart) {
            return MonthlySummary.builder()
                    .year(year).month(month)
                    .baseSalary(BigDecimal.ZERO)
                    .totalOvertimeMinutes(overtimeMinutes)
                    .overtimePay(BigDecimal.ZERO)
                    .totalExpenses(BigDecimal.ZERO)
                    .carriedOver(BigDecimal.ZERO)
                    .finalBalance(BigDecimal.ZERO)
                    .missingSaturdays(missingSaturdays)
                    .build();
        }

        SalaryConfig config = salaryConfigRepository
                .findFirstByActiveTrueOrderByUpdatedAtDesc().orElse(null);

        BigDecimal baseSalary = config != null ? config.getBaseSalary() : BigDecimal.ZERO;

        BigDecimal overtimePay = BigDecimal.ZERO;
        if (config != null && overtimeMinutes != 0) {
            BigDecimal hourlyRate = config.getBaseSalary()
                    .divide(BigDecimal.valueOf(config.getMonthlyHoursDivisor()), 4, RoundingMode.HALF_UP);
            
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

        List<Expense> expenses = expenseRepository.findActiveForMonth(month, year);
        BigDecimal totalExpenses = expenses.stream()
                .map(Expense::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal carriedOver = getCarriedOverFromPreviousMonth(month, year);
        BigDecimal finalBalance = baseSalary.add(overtimePay).subtract(totalExpenses).add(carriedOver);

        MonthlySummary summary = monthlySummaryRepository.findByMonthAndYear(month, year)
                .orElse(MonthlySummary.builder().month(month).year(year).build());

        summary.setBaseSalary(baseSalary);
        summary.setTotalOvertimeMinutes(overtimeMinutes);
        summary.setOvertimePay(overtimePay);
        summary.setTotalExpenses(totalExpenses);
        summary.setCarriedOver(carriedOver);
        summary.setFinalBalance(finalBalance);
        summary.setMissingSaturdays(missingSaturdays);

        return monthlySummaryRepository.save(summary);
    }

    private BigDecimal getCarriedOverFromPreviousMonth(int month, int year) {
        List<MonthlySummary> prev = monthlySummaryRepository.findPreviousMonths(month, year);
        if (prev.isEmpty()) return BigDecimal.ZERO;
        MonthlySummary last = prev.get(0);
        BigDecimal balance = last.getFinalBalance();
        return (balance != null && balance.compareTo(BigDecimal.ZERO) > 0) ? balance : BigDecimal.ZERO;
    }

    public MonthlySummary getSummary(int year, int month) {
        return recalculateMonthlySummary(month, year);
    }

    public MonthlySummary getCurrentMonthSummary() {
        Cycle cycle = CycleUtils.getCurrentCycle(LocalDate.now());
        return getSummary(cycle.year, cycle.month);
    }

    public List<MonthlySummary> getAllSummaries() {
        return monthlySummaryRepository.findAllByOrderByYearDescMonthDesc();
    }
}
