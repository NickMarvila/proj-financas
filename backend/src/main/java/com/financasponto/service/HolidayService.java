package com.financasponto.service;

import com.financasponto.entity.Holiday;
import com.financasponto.entity.Usuario;
import com.financasponto.repository.HolidayRepository;
import com.financasponto.utils.BrazilianHolidays;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class HolidayService {

    private final HolidayRepository holidayRepository;
    private final TimeRecordService timeRecordService;
    private final FinanceService financeService;

    public List<Holiday> getHolidaysForUser(Usuario user, Integer year) {
        int targetYear = year != null ? year : LocalDate.now().getYear();
        LocalDate start = LocalDate.of(targetYear, 1, 1);
        LocalDate end = LocalDate.of(targetYear, 12, 31);

        List<Holiday> existing = holidayRepository.findByUserIdAndDateBetweenOrderByDateAsc(user.getId(), start, end);
        if (existing.isEmpty()) {
            // Auto-popular feriados nacionais se o usuário não tiver nenhum registrado para este ano
            populateNationalHolidays(user, targetYear);
            existing = holidayRepository.findByUserIdAndDateBetweenOrderByDateAsc(user.getId(), start, end);
        }
        return existing;
    }

    public List<Holiday> getHolidaysForCycle(Usuario user, LocalDate start, LocalDate end) {
        return holidayRepository.findByUserIdAndDateBetweenOrderByDateAsc(user.getId(), start, end);
    }

    @Transactional
    public List<Holiday> populateNationalHolidays(Usuario user, int year) {
        List<BrazilianHolidays.HolidayDefinition> definitions = BrazilianHolidays.getHolidaysForYear(year);
        for (BrazilianHolidays.HolidayDefinition def : definitions) {
            if (!holidayRepository.existsByUserIdAndDate(user.getId(), def.date())) {
                Holiday h = Holiday.builder()
                        .user(user)
                        .date(def.date())
                        .name(def.name())
                        .isNational(def.isNational())
                        .build();
                holidayRepository.save(h);
                // Atualizar jornada do dia se aplicável
                timeRecordService.recalculateWorkDay(user, def.date());
            }
        }
        financeService.recalculateMonthlySummary(user, LocalDate.now().getMonthValue(), year);
        return holidayRepository.findByUserIdAndDateBetweenOrderByDateAsc(
                user.getId(), LocalDate.of(year, 1, 1), LocalDate.of(year, 12, 31));
    }

    @Transactional
    public Holiday createOrUpdate(Usuario user, LocalDate date, String name, Boolean isNational) {
        Holiday holiday = holidayRepository.findByUserIdAndDate(user.getId(), date)
                .orElse(Holiday.builder().user(user).date(date).build());

        holiday.setName(name);
        holiday.setIsNational(isNational != null ? isNational : false);
        Holiday saved = holidayRepository.save(holiday);

        timeRecordService.recalculateWorkDay(user, date);
        financeService.recalculateMonthlySummary(user, date.getMonthValue(), date.getYear());
        return saved;
    }

    @Transactional
    public void deleteHoliday(Usuario user, Long id) {
        holidayRepository.findById(id).ifPresent(h -> {
            if (h.getUser().getId().equals(user.getId())) {
                LocalDate date = h.getDate();
                holidayRepository.delete(h);
                timeRecordService.recalculateDayPunches(user, date);
                financeService.recalculateMonthlySummary(user, date.getMonthValue(), date.getYear());
            }
        });
    }

    @Transactional
    public void deleteHolidayByDate(Usuario user, LocalDate date) {
        holidayRepository.deleteByUserIdAndDate(user.getId(), date);
        timeRecordService.recalculateDayPunches(user, date);
        financeService.recalculateMonthlySummary(user, date.getMonthValue(), date.getYear());
    }

    public boolean isHoliday(Long userId, LocalDate date) {
        return holidayRepository.existsByUserIdAndDate(userId, date);
    }
}
