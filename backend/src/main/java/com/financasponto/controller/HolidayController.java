package com.financasponto.controller;

import com.financasponto.entity.Holiday;
import com.financasponto.entity.Usuario;
import com.financasponto.security.CurrentUser;
import com.financasponto.service.HolidayService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/holidays")
@RequiredArgsConstructor
public class HolidayController {

    private final HolidayService holidayService;
    private final CurrentUser currentUser;

    @GetMapping
    public ResponseEntity<List<Holiday>> listHolidays(@RequestParam(required = false) Integer year) {
        Usuario user = currentUser.get();
        return ResponseEntity.ok(holidayService.getHolidaysForUser(user, year));
    }

    @PostMapping
    public ResponseEntity<Holiday> createHoliday(@RequestBody Map<String, Object> body) {
        Usuario user = currentUser.get();
        LocalDate date = LocalDate.parse(String.valueOf(body.get("date")));
        String name = body.get("name") != null ? String.valueOf(body.get("name")) : "Feriado";
        Boolean isNational = body.get("isNational") != null ? Boolean.parseBoolean(String.valueOf(body.get("isNational"))) : false;
        return ResponseEntity.ok(holidayService.createOrUpdate(user, date, name, isNational));
    }

    @PostMapping("/populate-national/{year}")
    public ResponseEntity<List<Holiday>> populateNational(@PathVariable int year) {
        Usuario user = currentUser.get();
        return ResponseEntity.ok(holidayService.populateNationalHolidays(user, year));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteHoliday(@PathVariable Long id) {
        Usuario user = currentUser.get();
        holidayService.deleteHoliday(user, id);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/by-date/{date}")
    public ResponseEntity<?> deleteHolidayByDate(@PathVariable String date) {
        Usuario user = currentUser.get();
        holidayService.deleteHolidayByDate(user, LocalDate.parse(date));
        return ResponseEntity.noContent().build();
    }
}
