package com.financasponto.controller;

import com.financasponto.entity.TimeRecord;
import com.financasponto.entity.Usuario;
import com.financasponto.entity.WorkDay;
import com.financasponto.repository.UsuarioRepository;
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
    private final UsuarioRepository usuarioRepository;
    private final CurrentUser currentUser;

    private Usuario resolveTargetUser(Long userId) {
        if (userId != null && currentUser.isAdmin()) {
            return usuarioRepository.findById(userId).orElse(currentUser.get());
        }
        return currentUser.get();
    }

    @GetMapping("/time-records/today")
    public ResponseEntity<List<TimeRecord>> getToday(@RequestParam(required = false) Long userId) {
        Usuario user = resolveTargetUser(userId);
        return ResponseEntity.ok(timeRecordService.getTodayRecords(user.getId()));
    }

    @GetMapping("/time-records/{year}/{month}")
    public ResponseEntity<List<TimeRecord>> getByMonth(
            @PathVariable int year,
            @PathVariable int month,
            @RequestParam(required = false) Long userId) {
        Usuario user = resolveTargetUser(userId);
        return ResponseEntity.ok(timeRecordService.getMonthRecords(user, year, month));
    }

    @GetMapping("/work-days/{year}/{month}")
    public ResponseEntity<List<WorkDay>> getWorkDays(
            @PathVariable int year,
            @PathVariable int month,
            @RequestParam(required = false) Long userId) {
        Usuario user = resolveTargetUser(userId);
        int cutDay = user.getFirstDayOfMonth() != null ? user.getFirstDayOfMonth() : 21;
        LocalDate calStart = LocalDate.of(year, month, 1);
        LocalDate calEnd = calStart.withDayOfMonth(calStart.lengthOfMonth());
        LocalDate cycleStart = com.financasponto.utils.CycleUtils.getCycleStart(year, month, cutDay);
        LocalDate cycleEnd = com.financasponto.utils.CycleUtils.getCycleEnd(year, month, cutDay);
        LocalDate start = cycleStart.isBefore(calStart) ? cycleStart : calStart;
        LocalDate end = cycleEnd.isAfter(calEnd) ? cycleEnd : calEnd;
        return ResponseEntity.ok(workDayRepository.findByUserIdAndDateBetweenOrderByDateDesc(user.getId(), start, end));
    }

    @GetMapping("/work-days/today")
    public ResponseEntity<WorkDay> getTodayWorkDay(@RequestParam(required = false) Long userId) {
        Usuario user = resolveTargetUser(userId);
        return workDayRepository.findByUserIdAndDate(user.getId(), LocalDate.now())
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.noContent().build());
    }

    @PostMapping("/time-records/manual")
    public ResponseEntity<Map<String, String>> addManual(
            @RequestBody Map<String, String> body,
            @RequestParam(required = false) Long userId) {
        try {
            Long targetId = userId;
            if (targetId == null && body.containsKey("userId") && body.get("userId") != null) {
                targetId = Long.parseLong(body.get("userId"));
            }
            Usuario user = resolveTargetUser(targetId);
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
            @PathVariable int year,
            @PathVariable int month,
            @PathVariable int day,
            @RequestParam(required = false) Long userId) {
        Usuario user = resolveTargetUser(userId);
        timeRecordService.recalculateWorkDay(user, LocalDate.of(year, month, day));
        return ResponseEntity.ok(Map.of("status", "recalculated"));
    }
}
