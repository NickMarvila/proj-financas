package com.financasponto.entity;

import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import com.fasterxml.jackson.annotation.JsonIgnore;

@Entity
@Table(name = "salary_config")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SalaryConfig {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id")
    @JsonIgnore
    private Usuario user;

    @Column(name = "base_salary", nullable = false, precision = 10, scale = 2)
    private BigDecimal baseSalary;

    // Adicional de hora extra (padrão 0.50 = 50%)
    @Column(name = "overtime_rate", nullable = false, precision = 4, scale = 2)
    private BigDecimal overtimeRate;

    // Horas mensais para cálculo (padrão 220 para CLT 44h)
    @Column(name = "monthly_hours_divisor")
    private Integer monthlyHoursDivisor;

    // Horas diárias contratuais (padrão 8)
    @Column(name = "daily_contract_hours")
    private Integer dailyContractHours;

    // Horas do sábado (padrão 4)
    @Column(name = "saturday_contract_hours")
    private Integer saturdayContractHours;

    @Column(nullable = false)
    private Boolean active;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    @PreUpdate
    void prePersist() {
        this.updatedAt = LocalDateTime.now();
        if (this.active == null) this.active = true;
        if (this.overtimeRate == null) this.overtimeRate = new BigDecimal("0.50");
        if (this.monthlyHoursDivisor == null) this.monthlyHoursDivisor = 220;
        if (this.dailyContractHours == null) this.dailyContractHours = 8;
        if (this.saturdayContractHours == null) this.saturdayContractHours = 4;
    }
}
