package com.financasponto.service;

import com.financasponto.entity.MonthlySummary;
import com.financasponto.entity.WorkDay;
import com.financasponto.repository.WorkDayRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Optional;

@Slf4j
@Service
@RequiredArgsConstructor
public class SchedulerService {

    private final GmailService gmailService;
    private final FinanceService financeService;
    private final WhatsAppService whatsAppService;
    private final WorkDayRepository workDayRepository;
    private final TimeRecordService timeRecordService;

    // Polling Gmail a cada 5 minutos
    @Scheduled(fixedDelay = 300_000)
    public void pollGmail() {
        log.debug("Polling Gmail...");
        try {
            int count = gmailService.pollAndProcess(false);
            if (count > 0) log.info("Processados {} e-mail(is) de ponto", count);
        } catch (Exception e) {
            log.error("Erro no polling do Gmail: {}", e.getMessage());
        }
    }

    // Verificar hora extra a cada 30 minutos (dias úteis)
    @Scheduled(cron = "0 0/30 8-22 * * MON-SAT")
    public void checkOvertimeAlert() {
        LocalDate today = LocalDate.now();
        Optional<WorkDay> workDayOpt = workDayRepository.findByDate(today);
        if (workDayOpt.isEmpty()) return;

        WorkDay workDay = workDayOpt.get();
        if (workDay.getOvertimeMinutes() != null
                && workDay.getOvertimeMinutes() > 0
                && Boolean.FALSE.equals(workDay.getOvertimeNotified())) {

            // Somar total de extras do mês
            LocalDate now = LocalDate.now();
            Integer totalOvertimeMinutes = workDayRepository
                    .sumOvertimeMinutesByYearAndMonth(now.getYear(), now.getMonthValue());
            BigDecimal totalValue = timeRecordService.calculateOvertimeValue(
                    totalOvertimeMinutes != null ? totalOvertimeMinutes : 0);

            whatsAppService.notifyOvertimeStarted(workDay, totalValue);

            workDay.setOvertimeNotified(true);
            workDayRepository.save(workDay);
        }
    }

    // Resumo diário às 12h
    @Scheduled(cron = "0 0 12 * * *")
    public void sendNoonSummary() {
        log.info("Enviando resumo do meio-dia via WhatsApp");
        whatsAppService.sendDailySummary(buildSummaryMessage());
    }

    // Resumo diário às 21h
    @Scheduled(cron = "0 0 21 * * *")
    public void sendEveningSummary() {
        log.info("Enviando resumo noturno via WhatsApp");
        whatsAppService.sendDailySummary(buildSummaryMessage());
    }

    // Recalcular resumo mensal todo dia à meia-noite
    @Scheduled(cron = "0 0 0 * * *")
    public void recalculateMonthly() {
        LocalDate today = LocalDate.now();
        financeService.recalculateMonthlySummary(today.getMonthValue(), today.getYear());
        log.info("Resumo mensal recalculado");
    }

    private String buildSummaryMessage() {
        LocalDate today = LocalDate.now();
        MonthlySummary summary = financeService.getCurrentMonthSummary();

        // Pontos de hoje
        List<com.financasponto.entity.TimeRecord> todayRecords = timeRecordService.getTodayRecords();
        StringBuilder pontos = new StringBuilder();
        DateTimeFormatter timeFmt = DateTimeFormatter.ofPattern("HH:mm");
        if (todayRecords.isEmpty()) {
            pontos.append("Nenhuma batida registrada hoje");
        } else {
            todayRecords.forEach(r ->
                pontos.append(r.getPunchType() == com.financasponto.entity.TimeRecord.PunchType.IN ? "▶ " : "⏹ ")
                      .append(r.getTimestamp().format(timeFmt)).append("\n"));
        }

        // Horas extras de hoje
        Optional<WorkDay> todayWorkDay = workDayRepository.findByDate(today);
        String overtimeToday = todayWorkDay.map(wd -> {
            int mins = wd.getOvertimeMinutes() != null ? wd.getOvertimeMinutes() : 0;
            return String.format("%dh %02dmin", mins / 60, mins % 60);
        }).orElse("0h 00min");

        int totalMins = summary.getTotalOvertimeMinutes() != null ? summary.getTotalOvertimeMinutes() : 0;
        String overtimeMonth = String.format("%dh %02dmin", totalMins / 60, totalMins % 60);

        return String.format(
            "📊 *RESUMO FINANCEIRO — %s*\n\n" +
            "📅 *Pontos de Hoje:*\n%s\n" +
            "⏱ *Hora extra hoje:* %s\n" +
            "⏱ *Hora extra no mês:* %s\n" +
            "💰 *Valor extras:* R$ %s\n\n" +
            "💼 *Salário base:* R$ %s\n" +
            "💳 *Despesas:* R$ %s\n" +
            "📦 *Sobra do mês ant.:* R$ %s\n" +
            "✅ *Saldo projetado:* *R$ %s*",
            today.format(DateTimeFormatter.ofPattern("dd/MM/yyyy")),
            pontos.toString().trim(),
            overtimeToday,
            overtimeMonth,
            safeStr(summary.getOvertimePay()),
            safeStr(summary.getBaseSalary()),
            safeStr(summary.getTotalExpenses()),
            safeStr(summary.getCarriedOver()),
            safeStr(summary.getFinalBalance())
        );
    }

    private String safeStr(BigDecimal val) {
        return val != null ? String.format("%.2f", val) : "0,00";
    }
}
