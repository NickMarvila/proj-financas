package com.financasponto.entity;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

@Entity
@Table(name = "usuarios")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Usuario {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true, nullable = false)
    private String username;

    @Column(nullable = false)
    private String password;

    /** Nome do colaborador exatamente como aparece no comprovante (linha "Nome:" do bloco COLABORADOR). */
    @Column(name = "employee_name")
    private String employeeName;

    @Column(unique = true)
    private String cpf;

    /** Anulável no banco: o ddl-auto não consegue criar coluna NOT NULL em tabela com dados. Null = USER. */
    @Enumerated(EnumType.STRING)
    private Role role = Role.USER;

    /** Telefone para notificações WhatsApp. Se nulo, o ADMIN usa o telefone global (app.whatsapp.phone). */
    @Column(name = "whatsapp_phone")
    private String whatsappPhone;

    @Column(name = "gmail_email")
    private String gmailEmail;

    @Column(name = "gmail_status")
    private String gmailStatus;

    @Column(name = "gmail_sync_from")
    private String gmailSyncFrom;

    @Column(name = "gmail_last_sync")
    private java.time.LocalDateTime gmailLastSync;

    @Column(name = "work_monday")
    private String workMonday;

    @Column(name = "work_tuesday")
    private String workTuesday;

    @Column(name = "work_wednesday")
    private String workWednesday;

    @Column(name = "work_thursday")
    private String workThursday;

    @Column(name = "work_friday")
    private String workFriday;

    @Column(name = "work_saturday")
    private String workSaturday;

    @Column(name = "work_sunday")
    private String workSunday;

    @Column(name = "monthly_hours_goal")
    private Integer monthlyHoursGoal;

    @Column(name = "first_day_of_week")
    private String firstDayOfWeek;

    @Column(name = "first_day_of_month")
    private Integer firstDayOfMonth;

    public boolean isAdmin() {
        return role == Role.ADMIN;
    }

    public int getContractMinutesForDate(java.time.LocalDate date) {
        if (date == null) return 480;
        java.time.DayOfWeek dow = date.getDayOfWeek();
        String schedule = switch (dow) {
            case MONDAY -> workMonday;
            case TUESDAY -> workTuesday;
            case WEDNESDAY -> workWednesday;
            case THURSDAY -> workThursday;
            case FRIDAY -> workFriday;
            case SATURDAY -> workSaturday;
            case SUNDAY -> workSunday;
        };
        return parseMinutesFromSchedule(schedule, dow);
    }

    public static int parseMinutesFromSchedule(String schedule, java.time.DayOfWeek dow) {
        if (schedule == null || schedule.trim().isEmpty()) {
            return getDefaultMinutesForDay(dow);
        }
        String lower = schedule.toLowerCase().trim();
        if (lower.contains("não") || lower.contains("nao") || lower.contains("folga") || lower.contains("descan")) {
            return 0;
        }

        java.util.regex.Pattern p = java.util.regex.Pattern.compile("\\b([01]?\\d|2[0-3]):([0-5]\\d)\\b");
        java.util.regex.Matcher m = p.matcher(schedule);
        java.util.List<Integer> times = new java.util.ArrayList<>();
        while (m.find()) {
            int hh = Integer.parseInt(m.group(1));
            int mm = Integer.parseInt(m.group(2));
            times.add(hh * 60 + mm);
        }

        if (times.size() < 2) {
            return getDefaultMinutesForDay(dow);
        }

        int total = 0;
        for (int i = 0; i + 1 < times.size(); i += 2) {
            int diff = times.get(i + 1) - times.get(i);
            if (diff > 0) {
                total += diff;
            }
        }

        return total > 0 ? total : getDefaultMinutesForDay(dow);
    }

    private static int getDefaultMinutesForDay(java.time.DayOfWeek dow) {
        return switch (dow) {
            case MONDAY, TUESDAY, WEDNESDAY, THURSDAY -> 510; // 8h30
            case FRIDAY -> 480; // 8h00
            case SATURDAY -> 240; // 4h00
            case SUNDAY -> 0; // Folga
        };
    }

    public enum Role {
        ADMIN, USER
    }
}
