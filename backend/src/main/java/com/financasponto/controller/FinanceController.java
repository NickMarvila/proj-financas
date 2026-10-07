package com.financasponto.controller;

import com.financasponto.entity.*;
import com.financasponto.security.CurrentUser;
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
    private final CurrentUser currentUser;

    @GetMapping("/salary")
    public ResponseEntity<SalaryConfig> getSalary() {
        SalaryConfig config = financeService.getSalaryConfig(currentUser.id());
        return config != null ? ResponseEntity.ok(config) : ResponseEntity.noContent().build();
    }

    @PostMapping("/salary")
    public ResponseEntity<SalaryConfig> saveSalary(@RequestBody SalaryConfig config) {
        return ResponseEntity.ok(financeService.saveSalaryConfig(currentUser.get(), config));
    }

    @GetMapping("/expenses")
    public ResponseEntity<List<Expense>> getExpenses() {
        return ResponseEntity.ok(financeService.getActiveExpenses(currentUser.id()));
    }

    @PostMapping("/expenses")
    public ResponseEntity<Expense> addExpense(@RequestBody Expense expense) {
        return ResponseEntity.ok(financeService.createExpense(currentUser.get(), expense));
    }

    @PutMapping("/expenses/{id}")
    public ResponseEntity<Expense> updateExpense(@PathVariable Long id, @RequestBody Expense expense) {
        return ResponseEntity.ok(financeService.updateExpense(currentUser.get(), id, expense));
    }

    @DeleteMapping("/expenses/{id}")
    public ResponseEntity<Void> deleteExpense(@PathVariable Long id) {
        financeService.deleteExpense(currentUser.id(), id);
        return ResponseEntity.ok().build();
    }

    @GetMapping("/monthly-summary")
    public ResponseEntity<List<MonthlySummary>> getAllSummaries() {
        return ResponseEntity.ok(financeService.getAllSummaries(currentUser.id()));
    }

    @GetMapping("/monthly-summary/{year}/{month}")
    public ResponseEntity<MonthlySummary> getSummary(@PathVariable int year, @PathVariable int month) {
        return ResponseEntity.ok(financeService.recalculateMonthlySummary(currentUser.get(), month, year));
    }

    @PostMapping("/monthly-summary/{year}/{month}/recalculate")
    public ResponseEntity<MonthlySummary> recalculate(@PathVariable int year, @PathVariable int month) {
        return ResponseEntity.ok(financeService.recalculateMonthlySummary(currentUser.get(), month, year));
    }
}
