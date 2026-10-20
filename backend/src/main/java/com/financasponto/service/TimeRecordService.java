package com.financasponto.service;

import com.financasponto.entity.*;
import com.financasponto.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.*;
import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class TimeRecordService {

    private final TimeRecordRepository timeRecordRepository;
    private final WorkDayRepository workDayRepository;
    private final SalaryConfigRepository salaryConfigRepository;
    private final WhatsAppService whatsAppService;
    private final FinanceService financeService;
    private final com.financasponto.repository.HolidayRepository holidayRepository;

    @Value("${app.work.daily-contract-hours:8}")
    private int dailyContractHours;

    @Value("${app.work.saturday-contract-hours:4}")
    private int saturdayContractHours;

    @Transactional
    public TimeRecord saveRecord(Usuario user, LocalDateTime timestamp, String origin, Boolean online,
                                  String hash, String emailMessageId, String rawText, boolean silent) {

        // Evitar duplicatas
        if (isAlreadyProcessed(emailMessageId)) {
            log.info("Registro já processado: {}", emailMessageId);
            return null;
        }

        // Mesma batida (mesmo usuário e mesmo instante) vinda em outro e-mail
        if (timeRecordRepository.existsByUserIdAndTimestamp(user.getId(), timestamp)) {
            log.info("Batida duplicada ignorada [{}]: {}", user.getUsername(), timestamp);
            return null;
        }

        // Determinar IN ou OUT baseado na quantidade de batidas do dia DESTE usuário
        LocalDate day = timestamp.toLocalDate();
        long countToday = timeRecordRepository.countByUserIdAndDate(user.getId(), day.atStartOfDay());
        TimeRecord.PunchType type = (countToday % 2 == 0)
                ? TimeRecord.PunchType.IN
                : TimeRecord.PunchType.OUT;

        TimeRecord record = TimeRecord.builder()
                .user(user)
                .timestamp(timestamp)
                .punchType(type)
                .origin(origin)
                .online(online)
                .hash(hash)
                .emailMessageId(emailMessageId)
                .rawText(rawText)
                .build();

        TimeRecord saved = timeRecordRepository.save(record);
        log.info("Ponto salvo [{}]: {} {} ({})", user.getUsername(), type, timestamp, origin);

        // Recalcular o dia de trabalho e a ordenação
        recalculateDayPunches(user, day);

        // Enviar notificação WhatsApp
        if (!silent) {
            whatsAppService.notifyPunchRegistered(user, saved);
        }

        return saved;
    }

    @Transactional
    public TimeRecord updateRecord(Usuario user, Long id, LocalDateTime newTimestamp, TimeRecord.PunchType newPunchType) {
        TimeRecord record = timeRecordRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Registro de ponto não encontrado"));

        if (!record.getUser().getId().equals(user.getId())) {
            throw new org.springframework.security.access.AccessDeniedException("Não autorizado a alterar este ponto");
        }

        LocalDate oldDate = record.getTimestamp().toLocalDate();
        LocalDate newDate = newTimestamp.toLocalDate();

        record.setTimestamp(newTimestamp);
        if (newPunchType != null) {
            record.setPunchType(newPunchType);
        }
        TimeRecord saved = timeRecordRepository.save(record);

        // Recalcular batidas e resumo dos dias afetados
        recalculateDayPunches(user, oldDate);
        if (!oldDate.equals(newDate)) {
            recalculateDayPunches(user, newDate);
        }

        return saved;
    }

    @Transactional
    public void deleteRecord(Usuario user, Long id) {
        TimeRecord record = timeRecordRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Registro de ponto não encontrado"));

        if (!record.getUser().getId().equals(user.getId())) {
            throw new org.springframework.security.access.AccessDeniedException("Não autorizado a excluir este ponto");
        }

        LocalDate date = record.getTimestamp().toLocalDate();
        timeRecordRepository.delete(record);

        // Recalcular batidas e resumo do dia afetado
        recalculateDayPunches(user, date);
    }

    @Transactional
    public void recalculateDayPunches(Usuario user, LocalDate date) {
        LocalDateTime startOfDay = date.atStartOfDay();
        LocalDateTime endOfDay = date.atTime(23, 59, 59);
        List<TimeRecord> records = timeRecordRepository
                .findByUserIdAndTimestampBetweenOrderByTimestampAsc(user.getId(), startOfDay, endOfDay);

        if (records.isEmpty()) {
            boolean isHoliday = holidayRepository.existsByUserIdAndDate(user.getId(), date);
            if (!isHoliday) {
                workDayRepository.findByUserIdAndDate(user.getId(), date)
                        .ifPresent(workDayRepository::delete);
            } else {
                recalculateWorkDay(user, date);
            }
            financeService.recalculateMonthlySummary(user, date.getMonthValue(), date.getYear());
            return;
        }

        // Reordenar IN e OUT em sequência cronológica
        for (int i = 0; i < records.size(); i++) {
            TimeRecord r = records.get(i);
            TimeRecord.PunchType expectedType = (i % 2 == 0) ? TimeRecord.PunchType.IN : TimeRecord.PunchType.OUT;
            if (r.getPunchType() != expectedType) {
                r.setPunchType(expectedType);
                timeRecordRepository.save(r);
            }
        }

        recalculateWorkDay(user, date);
        financeService.recalculateMonthlySummary(user, date.getMonthValue(), date.getYear());
    }

    /** Global (não por usuário): o id da mensagem do Gmail é único independente do dono da batida. */
    public boolean isAlreadyProcessed(String emailMessageId) {
        if (emailMessageId == null) return false;
        return timeRecordRepository.findByEmailMessageId(emailMessageId).isPresent();
    }

    @Transactional
    public void recalculateWorkDay(Usuario user, LocalDate date) {
        LocalDateTime startOfDay = date.atStartOfDay();
        LocalDateTime endOfDay = date.atTime(23, 59, 59);
        List<TimeRecord> records = timeRecordRepository
                .findByUserIdAndTimestampBetweenOrderByTimestampAsc(user.getId(), startOfDay, endOfDay);

        com.financasponto.entity.Holiday holiday = holidayRepository.findByUserIdAndDate(user.getId(), date).orElse(null);
        boolean isHoliday = holiday != null;
        String holidayName = isHoliday ? holiday.getName() : null;

        if (records.isEmpty()) {
            if (isHoliday) {
                WorkDay workDay = workDayRepository.findByUserIdAndDate(user.getId(), date)
                        .orElse(WorkDay.builder().user(user).date(date).overtimeNotified(false).build());
                workDay.setWorkedMinutes(0);
                workDay.setContractMinutes(0);
                workDay.setOvertimeMinutes(0);
                workDay.setOvertimeValue(BigDecimal.ZERO);
                workDay.setIsSaturday(date.getDayOfWeek() == DayOfWeek.SATURDAY);
                workDay.setStatus(WorkDay.DayStatus.HOLIDAY);
                workDay.setHolidayName(holidayName);
                workDayRepository.save(workDay);
            }
            return;
        }

        // Calcular minutos trabalhados (pares IN/OUT)
        int workedMinutes = 0;
        boolean isSaturday = date.getDayOfWeek() == DayOfWeek.SATURDAY;

        for (int i = 0; i + 1 < records.size(); i += 2) {
            TimeRecord in = records.get(i);
            TimeRecord out = records.get(i + 1);
            
            long totalMins = Duration.between(in.getTimestamp(), out.getTimestamp()).toMinutes();
            if (totalMins > 0) {
                workedMinutes += (int) totalMins;
            }
        }

        int contractMinutes = isHoliday ? 0 : user.getContractMinutesForDate(date);
        // Hora extra só existe depois de cumprida a jornada normal acordada para este dia da semana
        int overtimeMinutes = Math.max(0, workedMinutes - contractMinutes);

        BigDecimal overtimeValue = calculateOvertimeValue(user.getId(), overtimeMinutes);

        WorkDay.DayStatus status;
        if (isHoliday) {
            status = workedMinutes > 0 ? WorkDay.DayStatus.OVERTIME : WorkDay.DayStatus.HOLIDAY;
        } else if (contractMinutes == 0) {
            status = workedMinutes > 0 ? WorkDay.DayStatus.OVERTIME : WorkDay.DayStatus.DAY_OFF;
        } else if (overtimeMinutes > 0) {
            status = WorkDay.DayStatus.OVERTIME;
        } else if (workedMinutes >= contractMinutes) {
            status = WorkDay.DayStatus.NORMAL;
        } else {
            status = WorkDay.DayStatus.INCOMPLETE;
        }

        WorkDay workDay = workDayRepository.findByUserIdAndDate(user.getId(), date)
                .orElse(WorkDay.builder().user(user).date(date).overtimeNotified(false).build());

        workDay.setWorkedMinutes(workedMinutes);
        workDay.setContractMinutes(contractMinutes);
        workDay.setOvertimeMinutes(overtimeMinutes);
        workDay.setOvertimeValue(overtimeValue);
        workDay.setIsSaturday(isSaturday);
        workDay.setStatus(status);
        workDay.setHolidayName(holidayName);

        workDayRepository.save(workDay);
    }

    @Transactional
    public void recalculateAllForUser(Usuario user) {
        List<WorkDay> allDays = workDayRepository.findByUserId(user.getId());
        Set<String> cycleMonths = new HashSet<>();
        for (WorkDay wd : allDays) {
            recalculateWorkDay(user, wd.getDate());
            cycleMonths.add(wd.getDate().getYear() + "-" + wd.getDate().getMonthValue());
        }
        for (String ym : cycleMonths) {
            String[] parts = ym.split("-");
            int y = Integer.parseInt(parts[0]);
            int m = Integer.parseInt(parts[1]);
            financeService.recalculateMonthlySummary(user, m, y);
        }
    }

    public BigDecimal calculateOvertimeValue(Long userId, int overtimeMinutes) {
        if (overtimeMinutes <= 0) return BigDecimal.ZERO;
        return salaryConfigRepository.findFirstByUserIdAndActiveTrueOrderByUpdatedAtDesc(userId)
                .map(config -> {
                    BigDecimal hourlyRate = config.getBaseSalary()
                            .divide(BigDecimal.valueOf(config.getMonthlyHoursDivisor()), 4, RoundingMode.HALF_UP);
                    BigDecimal overtimeRate = BigDecimal.ONE.add(config.getOvertimeRate());
                    BigDecimal hours = BigDecimal.valueOf(overtimeMinutes).divide(BigDecimal.valueOf(60), 4, RoundingMode.HALF_UP);
                    return hourlyRate.multiply(overtimeRate).multiply(hours).setScale(2, RoundingMode.HALF_UP);
                })
                .orElse(BigDecimal.ZERO);
    }

    public List<TimeRecord> getTodayRecords(Long userId) {
        LocalDateTime now = LocalDateTime.now();
        return timeRecordRepository.findByUserIdAndTimestampBetweenOrderByTimestampAsc(
                userId,
                now.toLocalDate().atStartOfDay(),
                now.toLocalDate().atTime(23, 59, 59));
    }

    public List<TimeRecord> getMonthRecords(Usuario user, int year, int month) {
        int cutDay = user.getFirstDayOfMonth() != null ? user.getFirstDayOfMonth() : 21;
        LocalDate start = com.financasponto.utils.CycleUtils.getCycleStart(year, month, cutDay);
        LocalDate end = com.financasponto.utils.CycleUtils.getCycleEnd(year, month, cutDay);
        return timeRecordRepository.findByUserIdAndTimestampBetweenOrderByTimestampAsc(
                user.getId(), start.atStartOfDay(), end.atTime(23, 59, 59));
    }

    public long countRecordsForDay(Long userId, LocalDate date) {
        if (userId == null || date == null) return 0;
        return timeRecordRepository.countByUserIdAndDate(userId, date.atStartOfDay());
    }
}
