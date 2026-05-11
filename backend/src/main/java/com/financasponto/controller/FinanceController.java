package com.financasponto.controller;

import com.financasponto.entity.*;
import com.financasponto.service.FinanceService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class FinanceController {

    private final FinanceService financeService;

    @GetMapping("/salary")
    public ResponseEntity<SalaryConfig> getSalary() {
        SalaryConfig config = financeService.getSalaryConfig();
        return config != null ? ResponseEntity.ok(config) : ResponseEntity.noContent().build();
    }

    @PostMapping("/salary")
    public ResponseEntity<SalaryConfig> saveSalary(@RequestBody SalaryConfig config) {
        return ResponseEntity.ok(financeService.saveSalaryConfig(config));
    }

    @GetMapping("/expenses")
    public ResponseEntity<List<Expense>> getExpenses() {
        return ResponseEntity.ok(financeService.getActiveExpenses());
    }

    @PostMapping("/expenses")
    public ResponseEntity<Expense> addExpense(@RequestBody Expense expense) {
        return ResponseEntity.ok(financeService.saveExpense(expense));
    }

    @PutMapping("/expenses/{id}")
    public ResponseEntity<Expense> updateExpense(@PathVariable Long id, @RequestBody Expense expense) {
        expense.setId(id);
        return ResponseEntity.ok(financeService.saveExpense(expense));
    }

    @DeleteMapping("/expenses/{id}")
    public ResponseEntity<Void> deleteExpense(@PathVariable Long id) {
        financeService.deleteExpense(id);
        return ResponseEntity.ok().build();
    }

    @GetMapping("/monthly-summary")
    public ResponseEntity<List<MonthlySummary>> getAllSummaries() {
        return ResponseEntity.ok(financeService.getAllSummaries());
    }

    @GetMapping("/monthly-summary/{year}/{month}")
    public ResponseEntity<MonthlySummary> getSummary(@PathVariable int year, @PathVariable int month) {
        return ResponseEntity.ok(financeService.recalculateMonthlySummary(month, year));
    }

    @PostMapping("/monthly-summary/{year}/{month}/recalculate")
    public ResponseEntity<MonthlySummary> recalculate(@PathVariable int year, @PathVariable int month) {
        return ResponseEntity.ok(financeService.recalculateMonthlySummary(month, year));
    }
}
