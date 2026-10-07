package com.financasponto.entity;

import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import com.fasterxml.jackson.annotation.JsonIgnore;

@Entity
@Table(name = "work_days",
       uniqueConstraints = @UniqueConstraint(name = "uk_work_days_user_date", columnNames = {"user_id", "date"}))
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class WorkDay {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id")
    @JsonIgnore
    private Usuario user;

    @Column(nullable = false)
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
