package com.financasponto.controller;

import com.financasponto.entity.TimeRecord;
import com.financasponto.entity.Usuario;
import com.financasponto.entity.WorkDay;
import com.financasponto.repository.WorkDayRepository;
import com.financasponto.security.CurrentUser;
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
    private final CurrentUser currentUser;

    @GetMapping("/time-records/today")
    public ResponseEntity<List<TimeRecord>> getToday() {
        return ResponseEntity.ok(timeRecordService.getTodayRecords(currentUser.id()));
    }

    @GetMapping("/time-records/{year}/{month}")
    public ResponseEntity<List<TimeRecord>> getByMonth(@PathVariable int year, @PathVariable int month) {
        return ResponseEntity.ok(timeRecordService.getMonthRecords(currentUser.get(), year, month));
    }

    @GetMapping("/work-days/{year}/{month}")
    public ResponseEntity<List<WorkDay>> getWorkDays(@PathVariable int year, @PathVariable int month) {
        Usuario user = currentUser.get();
        int cutDay = user.getFirstDayOfMonth() != null ? user.getFirstDayOfMonth() : 21;
        LocalDate start = com.financasponto.utils.CycleUtils.getCycleStart(year, month, cutDay);
        LocalDate end = com.financasponto.utils.CycleUtils.getCycleEnd(year, month, cutDay);
        return ResponseEntity.ok(workDayRepository.findByUserIdAndDateBetweenOrderByDateDesc(user.getId(), start, end));
    }

    @GetMapping("/work-days/today")
    public ResponseEntity<WorkDay> getTodayWorkDay() {
        return workDayRepository.findByUserIdAndDate(currentUser.id(), LocalDate.now())
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.noContent().build());
    }

    @PostMapping("/time-records/manual")
    public ResponseEntity<Map<String, String>> addManual(@RequestBody Map<String, String> body) {
        try {
            Usuario user = currentUser.get();
            java.time.LocalDateTime ts = java.time.LocalDateTime.parse(body.get("timestamp"));
            timeRecordService.saveRecord(user, ts, "MANUAL", true, null, null, "Registro manual", false);
            return ResponseEntity.ok(Map.of("status", "ok"));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", String.valueOf(e.getMessage())));
        }
    }

    @PutMapping("/time-records/{id}")
    public ResponseEntity<?> updateRecord(
            @PathVariable Long id,
            @RequestBody Map<String, String> body) {
        try {
            Usuario user = currentUser.get();
            java.time.LocalDateTime timestamp = java.time.LocalDateTime.parse(body.get("timestamp"));
            TimeRecord.PunchType type = (body.containsKey("punchType") && body.get("punchType") != null && !body.get("punchType").isEmpty())
                    ? TimeRecord.PunchType.valueOf(body.get("punchType"))
                    : null;
            TimeRecord updated = timeRecordService.updateRecord(user, id, timestamp, type);
            return ResponseEntity.ok(updated);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.notFound().build();
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", String.valueOf(e.getMessage())));
        }
    }

    @DeleteMapping("/time-records/{id}")
    public ResponseEntity<?> deleteRecord(@PathVariable Long id) {
        try {
            Usuario user = currentUser.get();
            timeRecordService.deleteRecord(user, id);
            return ResponseEntity.ok(Map.of("status", "deleted"));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.notFound().build();
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", String.valueOf(e.getMessage())));
        }
    }

    @PostMapping("/work-days/{year}/{month}/{day}/recalculate")
    public ResponseEntity<Map<String, String>> recalculate(
            @PathVariable int year, @PathVariable int month, @PathVariable int day) {
        timeRecordService.recalculateWorkDay(currentUser.get(), LocalDate.of(year, month, day));
        return ResponseEntity.ok(Map.of("status", "recalculated"));
    }
}
