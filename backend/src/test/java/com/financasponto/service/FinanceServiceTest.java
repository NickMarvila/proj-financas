package com.financasponto.service;

import com.financasponto.entity.Expense;
import com.financasponto.entity.MonthlySummary;
import com.financasponto.entity.SalaryConfig;
import com.financasponto.entity.Usuario;
import com.financasponto.repository.ExpenseRepository;
import com.financasponto.repository.MonthlySummaryRepository;
import com.financasponto.repository.SalaryConfigRepository;
import com.financasponto.repository.WorkDayRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Seam único do balanço mensal: o saldo de um ciclo é isolado,
 * isto é, salário + extras líquidas − despesas, sem herdar nada de meses anteriores.
 */
class FinanceServiceTest {

    private static final int MONTH = 5;
    private static final int YEAR = 2026;

    private SalaryConfigRepository salaryConfigRepository;
    private ExpenseRepository expenseRepository;
    private MonthlySummaryRepository monthlySummaryRepository;
    private WorkDayRepository workDayRepository;
    private FinanceService service;
    private Usuario user;

    @BeforeEach
    void setUp() {
        salaryConfigRepository = mock(SalaryConfigRepository.class);
        expenseRepository = mock(ExpenseRepository.class);
        monthlySummaryRepository = mock(MonthlySummaryRepository.class);
        workDayRepository = mock(WorkDayRepository.class);
        service = new FinanceService(salaryConfigRepository, expenseRepository,
                monthlySummaryRepository, workDayRepository);

        user = new Usuario();
        user.setId(1L);
        user.setFirstDayOfMonth(21);
        user.setWorkSaturday("Folga"); // evita compensação/faltas de sábado nestes cenários

        when(monthlySummaryRepository.save(any(MonthlySummary.class))).thenAnswer(inv -> inv.getArgument(0));
        when(workDayRepository.sumOvertimeMinutesByUserIdAndDateBetween(anyLong(), any(), any())).thenReturn(0);
    }

    private void givenSalary(String amount) {
        SalaryConfig config = SalaryConfig.builder()
                .baseSalary(new BigDecimal(amount))
                .overtimeRate(new BigDecimal("0.50"))
                .monthlyHoursDivisor(220)
                .active(true)
                .build();
        when(salaryConfigRepository.findFirstByUserIdAndActiveTrueOrderByUpdatedAtDesc(1L))
                .thenReturn(Optional.of(config));
    }

    private void givenExpense(String amount) {
        Expense expense = new Expense();
        expense.setAmount(new BigDecimal(amount));
        when(expenseRepository.findActiveForMonthByUserId(1L, MONTH, YEAR)).thenReturn(List.of(expense));
    }

    private void givenPreviousMonthWithPositiveBalance(String balance) {
        MonthlySummary previous = MonthlySummary.builder()
                .month(MONTH - 1).year(YEAR)
                .finalBalance(new BigDecimal(balance))
                .build();
        when(monthlySummaryRepository.findByUserIdOrderByYearDescMonthDesc(anyLong()))
                .thenReturn(List.of(previous));
    }

    @Test
    void finalBalanceIgnoresPositiveBalanceOfPreviousMonth() {
        givenSalary("3000.00");
        givenExpense("500.00");
        givenPreviousMonthWithPositiveBalance("1000.00");

        MonthlySummary summary = service.getSummary(user, YEAR, MONTH);

        assertEquals(0, new BigDecimal("2500.00").compareTo(summary.getFinalBalance()));
    }

    @Test
    void negativeBalanceIsReturnedWithoutTruncating() {
        givenSalary("3000.00");
        givenExpense("3500.00");

        MonthlySummary summary = service.getSummary(user, YEAR, MONTH);

        assertEquals(0, new BigDecimal("-500.00").compareTo(summary.getFinalBalance()));
    }

    @Test
    void futureMonthStaysZeroed() {
        givenSalary("3000.00");

        MonthlySummary summary = service.getSummary(user, 2999, 1);

        assertEquals(0, BigDecimal.ZERO.compareTo(summary.getFinalBalance()));
    }

    @Test
    void monthBeforeSystemStartStaysZeroed() {
        givenSalary("3000.00");

        MonthlySummary summary = service.getSummary(user, 2026, 3);

        assertEquals(0, BigDecimal.ZERO.compareTo(summary.getFinalBalance()));
    }
}
