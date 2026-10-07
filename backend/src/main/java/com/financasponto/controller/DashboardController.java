package com.financasponto.controller;

import com.financasponto.entity.MonthlySummary;
import com.financasponto.entity.Usuario;
import com.financasponto.entity.WorkDay;
import com.financasponto.repository.WorkDayRepository;
import com.financasponto.security.CurrentUser;
import com.financasponto.service.FinanceService;
import com.financasponto.service.TimeRecordService;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.*;

import com.financasponto.utils.CycleUtils;

@RestController
@RequestMapping("/api/dashboard")
@RequiredArgsConstructor
public class DashboardController {

    private final FinanceService financeService;
    private final TimeRecordService timeRecordService;
    private final WorkDayRepository workDayRepository;
    private final CurrentUser currentUser;

    @GetMapping
    public ResponseEntity<Map<String, Object>> getDashboard(
            @RequestParam(required = false) Integer year,
            @RequestParam(required = false) Integer month) {
        
        LocalDate today = LocalDate.now();
        CycleUtils.Cycle cycle = CycleUtils.getCurrentCycle(today);
        int y = (year != null) ? year : cycle.year;
        int m = (month != null) ? month : cycle.month;
        
        LocalDate targetDate = (y == cycle.year && m == cycle.month) 
                ? today 
                : CycleUtils.getCycleEnd(y, m);
        
        Usuario user = currentUser.get();
        MonthlySummary summary = financeService.getSummary(user, y, m);
        Optional<WorkDay> targetWorkDay = workDayRepository.findByUserIdAndDate(user.getId(), targetDate);
        
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("today", targetDate.toString());
        response.put("monthSummary", summary);
        response.put("todayRecords", timeRecordService.getMonthRecords(user.getId(), y, m)
                .stream().filter(r -> r.getTimestamp().toLocalDate().equals(targetDate)).toList());
        response.put("todayWorkDay", targetWorkDay.orElse(null));
        response.put("currentMonth", Map.of("month", m, "year", y));

        return ResponseEntity.ok(response);
    }
}
