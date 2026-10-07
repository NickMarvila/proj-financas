package com.financasponto.entity;

import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import com.fasterxml.jackson.annotation.JsonIgnore;

@Entity
@Table(name = "monthly_summary",
       uniqueConstraints = @UniqueConstraint(name = "uk_monthly_summary_user_month_year", columnNames = {"user_id", "month", "year"}))
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MonthlySummary {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id")
    @JsonIgnore
    private Usuario user;

    @Column(nullable = false)
    private Integer month;

    @Column(nullable = false)
    private Integer year;

    // Salário base do mês
    @Column(name = "base_salary", precision = 10, scale = 2)
    private BigDecimal baseSalary;

    // Total de minutos extras no mês
    @Column(name = "total_overtime_minutes")
    private Integer totalOvertimeMinutes;

    // Valor total das horas extras
    @Column(name = "overtime_pay", precision = 10, scale = 2)
    private BigDecimal overtimePay;

    // Total de despesas do mês
    @Column(name = "total_expenses", precision = 10, scale = 2)
    private BigDecimal totalExpenses;

    // Sobra do mês anterior
    @Column(name = "carried_over", precision = 10, scale = 2)
    private BigDecimal carriedOver;

    @Column(name = "final_balance", precision = 10, scale = 2)
    private BigDecimal finalBalance;

    @Column(name = "missing_saturdays")
    private Integer missingSaturdays;

    @Column(name = "closed")
    private Boolean closed;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    @PreUpdate
    void prePersist() {
        this.updatedAt = LocalDateTime.now();
        if (this.closed == null) this.closed = false;
        if (this.carriedOver == null) this.carriedOver = BigDecimal.ZERO;
    }
}
