package com.financasponto.service;

import com.financasponto.entity.TimeRecord;
import com.financasponto.entity.Usuario;
import com.financasponto.entity.WorkDay;
import com.financasponto.repository.SalaryConfigRepository;
import com.financasponto.repository.TimeRecordRepository;
import com.financasponto.repository.WorkDayRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Seam do apuramento diário: hora extra só existe depois de cumprida a jornada normal do dia.
 */
class TimeRecordServiceOvertimeTest {

    private static final LocalDate SATURDAY = LocalDate.of(2026, 10, 17);
    private static final LocalDate WEDNESDAY = LocalDate.of(2026, 10, 14);

    private TimeRecordRepository timeRecordRepository;
    private WorkDayRepository workDayRepository;
    private TimeRecordService service;
    private Usuario user;

    @BeforeEach
    void setUp() {
        timeRecordRepository = mock(TimeRecordRepository.class);
        workDayRepository = mock(WorkDayRepository.class);
        service = new TimeRecordService(timeRecordRepository, workDayRepository,
                mock(SalaryConfigRepository.class), mock(WhatsAppService.class), mock(FinanceService.class));
        ReflectionTestUtils.setField(service, "dailyContractHours", 8);
        ReflectionTestUtils.setField(service, "saturdayContractHours", 4);

        user = new Usuario();
        user.setId(1L);
    }

    private TimeRecord punch(LocalDate day, int hour, int minute) {
        TimeRecord r = new TimeRecord();
        r.setTimestamp(day.atTime(hour, minute));
        return r;
    }

    private WorkDay recalculate(LocalDate day, TimeRecord... punches) {
        when(timeRecordRepository.findByUserIdAndTimestampBetweenOrderByTimestampAsc(
                anyLong(), any(LocalDateTime.class), any(LocalDateTime.class))).thenReturn(List.of(punches));
        service.recalculateWorkDay(user, day);
        ArgumentCaptor<WorkDay> saved = ArgumentCaptor.forClass(WorkDay.class);
        verify(workDayRepository).save(saved.capture());
        return saved.getValue();
    }

    @Test
    void saturdayShortOfContractHasNoOvertimeEvenIfPunchedOutAfterNoon() {
        // 08:08 -> 12:04 = 3h56 (faltaram 4 min): nada de hora extra
        WorkDay wd = recalculate(SATURDAY, punch(SATURDAY, 8, 8), punch(SATURDAY, 12, 4));

        assertEquals(236, wd.getWorkedMinutes());
        assertEquals(0, wd.getOvertimeMinutes());
        assertEquals(WorkDay.DayStatus.INCOMPLETE, wd.getStatus());
    }

    @Test
    void saturdayOvertimeOnlyCountsMinutesBeyondContract() {
        // 08:00 -> 12:30 = 4h30: 30 min além das 4h
        WorkDay wd = recalculate(SATURDAY, punch(SATURDAY, 8, 0), punch(SATURDAY, 12, 30));

        assertEquals(270, wd.getWorkedMinutes());
        assertEquals(30, wd.getOvertimeMinutes());
        assertEquals(WorkDay.DayStatus.OVERTIME, wd.getStatus());
    }

    @Test
    void saturdayExactlyContractHasNoOvertime() {
        WorkDay wd = recalculate(SATURDAY, punch(SATURDAY, 8, 0), punch(SATURDAY, 12, 0));

        assertEquals(0, wd.getOvertimeMinutes());
        assertEquals(WorkDay.DayStatus.NORMAL, wd.getStatus());
    }

    @Test
    void saturdayWithBreakDoesNotCountAfternoonAsOvertimeUntilContractIsMet() {
        // 08:00-11:00 (3h) + 12:30-13:00 (30min) = 3h30 < 4h: sem extra
        WorkDay wd = recalculate(SATURDAY,
                punch(SATURDAY, 8, 0), punch(SATURDAY, 11, 0),
                punch(SATURDAY, 12, 30), punch(SATURDAY, 13, 0));

        assertEquals(210, wd.getWorkedMinutes());
        assertEquals(0, wd.getOvertimeMinutes());
    }

    @Test
    void weekdayShortOfContractHasNoOvertime() {
        // 08:00-12:00 + 13:00-16:56 = 7h56 (faltaram 4 min)
        WorkDay wd = recalculate(WEDNESDAY,
                punch(WEDNESDAY, 8, 0), punch(WEDNESDAY, 12, 0),
                punch(WEDNESDAY, 13, 0), punch(WEDNESDAY, 16, 56));

        assertEquals(0, wd.getOvertimeMinutes());
    }
}
