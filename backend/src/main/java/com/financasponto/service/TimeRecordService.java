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

    @Value("${app.work.daily-contract-hours:8}")
    private int dailyContractHours;

    @Value("${app.work.saturday-contract-hours:4}")
    private int saturdayContractHours;

    @Transactional
    public TimeRecord saveRecord(LocalDateTime timestamp, String origin, Boolean online,
                                  String hash, String emailMessageId, String rawText, boolean silent) {

        // Evitar duplicatas
        if (isAlreadyProcessed(emailMessageId)) {
            log.info("Registro já processado: {}", emailMessageId);
            return null;
        }

        // Determinar IN ou OUT baseado na quantidade de batidas do dia
        LocalDate day = timestamp.toLocalDate();
        long countToday = timeRecordRepository.countByDate(day.atStartOfDay());
        TimeRecord.PunchType type = (countToday % 2 == 0)
                ? TimeRecord.PunchType.IN
                : TimeRecord.PunchType.OUT;

        TimeRecord record = TimeRecord.builder()
                .timestamp(timestamp)
                .punchType(type)
                .origin(origin)
                .online(online)
                .hash(hash)
                .emailMessageId(emailMessageId)
                .rawText(rawText)
                .build();

        TimeRecord saved = timeRecordRepository.save(record);
        log.info("Ponto salvo: {} {} ({})", type, timestamp, origin);

        // Recalcular o dia de trabalho
        recalculateWorkDay(day);

        // Enviar notificação WhatsApp
        if (!silent) {
            whatsAppService.notifyPunchRegistered(saved);
        }

        return saved;
    }

    public boolean isAlreadyProcessed(String emailMessageId) {
        if (emailMessageId == null) return false;
        return timeRecordRepository.findByEmailMessageId(emailMessageId).isPresent();
    }

    @Transactional
    public void recalculateWorkDay(LocalDate date) {
        LocalDateTime startOfDay = date.atStartOfDay();
        LocalDateTime endOfDay = date.atTime(23, 59, 59);
        List<TimeRecord> records = timeRecordRepository
                .findByTimestampBetweenOrderByTimestampAsc(startOfDay, endOfDay);

        if (records.isEmpty()) return;

        // Calcular minutos trabalhados (pares IN/OUT)
        int workedMinutes = 0;
        int postNoonOvertime = 0;
        boolean isSaturday = date.getDayOfWeek() == DayOfWeek.SATURDAY;
        LocalDateTime noon = date.atTime(12, 0);

        for (int i = 0; i + 1 < records.size(); i += 2) {
            TimeRecord in = records.get(i);
            TimeRecord out = records.get(i + 1);
            
            long totalMins = Duration.between(in.getTimestamp(), out.getTimestamp()).toMinutes();
            if (totalMins > 0) {
                workedMinutes += (int) totalMins;
                
                if (isSaturday) {
                    LocalDateTime inTime = in.getTimestamp();
                    LocalDateTime outTime = out.getTimestamp();
                    
                    if (!inTime.isBefore(noon)) {
                        // Período inteiro foi após as 12h
                        postNoonOvertime += (int) totalMins;
                    } else if (outTime.isAfter(noon)) {
                        // Começou antes, mas cruzou as 12h
                        postNoonOvertime += (int) Duration.between(noon, outTime).toMinutes();
                    }
                }
            }
        }

        int contractMinutes = (isSaturday ? saturdayContractHours : dailyContractHours) * 60;
        int overtimeMinutes = 0;

        if (isSaturday) {
            int normalWorked = workedMinutes - postNoonOvertime;
            overtimeMinutes = postNoonOvertime;
            if (normalWorked > contractMinutes) {
                overtimeMinutes += (normalWorked - contractMinutes);
            }
        } else {
            overtimeMinutes = Math.max(0, workedMinutes - contractMinutes);
        }

        BigDecimal overtimeValue = calculateOvertimeValue(overtimeMinutes);

        WorkDay.DayStatus status = overtimeMinutes > 0 ? WorkDay.DayStatus.OVERTIME
                : workedMinutes >= contractMinutes ? WorkDay.DayStatus.NORMAL
                : WorkDay.DayStatus.INCOMPLETE;

        WorkDay workDay = workDayRepository.findByDate(date)
                .orElse(WorkDay.builder().date(date).overtimeNotified(false).build());

        workDay.setWorkedMinutes(workedMinutes);
        workDay.setContractMinutes(contractMinutes);
        workDay.setOvertimeMinutes(overtimeMinutes);
        workDay.setOvertimeValue(overtimeValue);
        workDay.setIsSaturday(isSaturday);
        workDay.setStatus(status);

        workDayRepository.save(workDay);
    }

    public BigDecimal calculateOvertimeValue(int overtimeMinutes) {
        if (overtimeMinutes <= 0) return BigDecimal.ZERO;
        return salaryConfigRepository.findFirstByActiveTrueOrderByUpdatedAtDesc()
                .map(config -> {
                    BigDecimal hourlyRate = config.getBaseSalary()
                            .divide(BigDecimal.valueOf(config.getMonthlyHoursDivisor()), 4, RoundingMode.HALF_UP);
                    BigDecimal overtimeRate = BigDecimal.ONE.add(config.getOvertimeRate());
                    BigDecimal hours = BigDecimal.valueOf(overtimeMinutes).divide(BigDecimal.valueOf(60), 4, RoundingMode.HALF_UP);
                    return hourlyRate.multiply(overtimeRate).multiply(hours).setScale(2, RoundingMode.HALF_UP);
                })
                .orElse(BigDecimal.ZERO);
    }

    public List<TimeRecord> getTodayRecords() {
        LocalDateTime now = LocalDateTime.now();
        return timeRecordRepository.findByTimestampBetweenOrderByTimestampAsc(
                now.toLocalDate().atStartOfDay(),
                now.toLocalDate().atTime(23, 59, 59));
    }

    public List<TimeRecord> getMonthRecords(int year, int month) {
        LocalDate start = com.financasponto.utils.CycleUtils.getCycleStart(year, month);
        LocalDate end = com.financasponto.utils.CycleUtils.getCycleEnd(year, month);
        return timeRecordRepository.findByTimestampBetweenOrderByTimestampAsc(
                start.atStartOfDay(), end.atTime(23, 59, 59));
    }
}
