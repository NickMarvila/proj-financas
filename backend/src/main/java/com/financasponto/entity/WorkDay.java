package com.financasponto.entity;

import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;
import java.time.LocalDate;

@Entity
@Table(name = "work_days")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class WorkDay {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private LocalDate date;

    // Horas trabalhadas no dia (em minutos)
    @Column(name = "worked_minutes")
    private Integer workedMinutes;

    // Horas contratuais do dia (em minutos) — 480 semana, 240 sábado
    @Column(name = "contract_minutes")
    private Integer contractMinutes;

    // Horas extras do dia (em minutos)
    @Column(name = "overtime_minutes")
    private Integer overtimeMinutes;

    // Valor das horas extras em R$
    @Column(name = "overtime_value", precision = 10, scale = 2)
    private BigDecimal overtimeValue;

    @Column(name = "is_saturday")
    private Boolean isSaturday;

    @Column(name = "overtime_notified")
    private Boolean overtimeNotified;

    @Enumerated(EnumType.STRING)
    private DayStatus status;

    public enum DayStatus {
        NORMAL, OVERTIME, INCOMPLETE, DAY_OFF
    }
}
