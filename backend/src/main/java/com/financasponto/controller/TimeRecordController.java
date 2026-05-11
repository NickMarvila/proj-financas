package com.financasponto.controller;

import com.financasponto.entity.TimeRecord;
import com.financasponto.entity.WorkDay;
import com.financasponto.repository.WorkDayRepository;
import com.financasponto.service.TimeRecordService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class TimeRecordController {

    private final TimeRecordService timeRecordService;
    private final WorkDayRepository workDayRepository;

    @GetMapping("/time-records/today")
    public ResponseEntity<List<TimeRecord>> getToday() {
        return ResponseEntity.ok(timeRecordService.getTodayRecords());
    }

    @GetMapping("/time-records/{year}/{month}")
    public ResponseEntity<List<TimeRecord>> getByMonth(@PathVariable int year, @PathVariable int month) {
        return ResponseEntity.ok(timeRecordService.getMonthRecords(year, month));
    }

    @GetMapping("/work-days/{year}/{month}")
    public ResponseEntity<List<WorkDay>> getWorkDays(@PathVariable int year, @PathVariable int month) {
        LocalDate start = com.financasponto.utils.CycleUtils.getCycleStart(year, month);
        LocalDate end = com.financasponto.utils.CycleUtils.getCycleEnd(year, month);
        return ResponseEntity.ok(workDayRepository.findByDateBetweenOrderByDateDesc(start, end));
    }

    @GetMapping("/work-days/today")
    public ResponseEntity<WorkDay> getTodayWorkDay() {
        return workDayRepository.findByDate(LocalDate.now())
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.noContent().build());
    }

    @PostMapping("/time-records/manual")
    public ResponseEntity<Map<String, String>> addManual(@RequestBody Map<String, String> body) {
        try {
            java.time.LocalDateTime ts = java.time.LocalDateTime.parse(body.get("timestamp"));
            timeRecordService.saveRecord(ts, "MANUAL", true, null, null, "Registro manual", false);
            return ResponseEntity.ok(Map.of("status", "ok"));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/work-days/{year}/{month}/{day}/recalculate")
    public ResponseEntity<Map<String, String>> recalculate(
            @PathVariable int year, @PathVariable int month, @PathVariable int day) {
        timeRecordService.recalculateWorkDay(LocalDate.of(year, month, day));
        return ResponseEntity.ok(Map.of("status", "recalculated"));
    }
}
