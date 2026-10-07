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
        LocalDate start = CycleUtils.getCycleStart(year, month);
        LocalDate end = CycleUtils.getCycleEnd(year, month);

        Integer overtimeMinutes = workDayRepository.sumOvertimeMinutesByUserIdAndDateBetween(userId, start, end);
        if (overtimeMinutes == null) overtimeMinutes = 0;

        // Sábados seguem o MÊS CALENDÁRIO (dia 1 ao último dia), NÃO o ciclo 21-20
        int totalSaturdays = CycleUtils.countSaturdaysInMonth(year, month);
        LocalDate startOfMonth = LocalDate.of(year, month, 1);
        LocalDate endOfMonth = startOfMonth.withDayOfMonth(startOfMonth.lengthOfMonth());
        long workedSaturdays = workDayRepository.countWorkedSaturdaysInCycle(userId, startOfMonth, endOfMonth);
        
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
                .findFirstByUserIdAndActiveTrueOrderByUpdatedAtDesc(userId).orElse(null);

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

        List<Expense> expenses = expenseRepository.findActiveForMonthByUserId(userId, month, year);
        BigDecimal totalExpenses = expenses.stream()
                .map(Expense::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal carriedOver = getCarriedOverFromPreviousMonth(userId, month, year);
        BigDecimal finalBalance = baseSalary.add(overtimePay).subtract(totalExpenses).add(carriedOver);

        MonthlySummary summary = monthlySummaryRepository.findByUserIdAndMonthAndYear(userId, month, year)
                .orElse(MonthlySummary.builder().user(user).month(month).year(year).build());

        summary.setBaseSalary(baseSalary);
        summary.setTotalOvertimeMinutes(overtimeMinutes);
        summary.setOvertimePay(overtimePay);
        summary.setTotalExpenses(totalExpenses);
        summary.setCarriedOver(carriedOver);
        summary.setFinalBalance(finalBalance);
        summary.setMissingSaturdays(missingSaturdays);

        return monthlySummaryRepository.save(summary);
    }

    private BigDecimal getCarriedOverFromPreviousMonth(Long userId, int month, int year) {
        List<MonthlySummary> prev = monthlySummaryRepository.findPreviousMonthsByUserId(userId, month, year);
        if (prev.isEmpty()) return BigDecimal.ZERO;
        MonthlySummary last = prev.get(0);
        BigDecimal balance = last.getFinalBalance();
        return (balance != null && balance.compareTo(BigDecimal.ZERO) > 0) ? balance : BigDecimal.ZERO;
    }

    public MonthlySummary getSummary(Usuario user, int year, int month) {
        return recalculateMonthlySummary(user, month, year);
    }

    public MonthlySummary getCurrentMonthSummary(Usuario user) {
        Cycle cycle = CycleUtils.getCurrentCycle(LocalDate.now());
        return getSummary(user, cycle.year, cycle.month);
    }

    public List<MonthlySummary> getAllSummaries(Long userId) {
        return monthlySummaryRepository.findByUserIdOrderByYearDescMonthDesc(userId);
    }
}
