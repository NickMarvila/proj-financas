package com.financasponto.entity;

import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "expenses")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Expense {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal amount;

    @Enumerated(EnumType.STRING)
    private ExpenseCategory category;

    // Dia do mês que vence (1-31)
    @Column(name = "due_day")
    private Integer dueDay;

    // Despesa recorrente (mensal) ou pontual
    @Column(nullable = false)
    private Boolean recurring;

    // Mês/ano para despesas pontuais (null = recorrente)
    private Integer month;
    private Integer year;

    @Column(nullable = false)
    private Boolean active;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @PrePersist
    void prePersist() {
        this.createdAt = LocalDateTime.now();
        if (this.active == null) this.active = true;
        if (this.recurring == null) this.recurring = true;
    }

    public enum ExpenseCategory {
        MORADIA, ALIMENTACAO, TRANSPORTE, SAUDE, EDUCACAO, LAZER, ASSINATURAS, OUTROS
    }
}
