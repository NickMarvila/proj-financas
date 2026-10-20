package com.financasponto.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "holidays",
       uniqueConstraints = @UniqueConstraint(name = "uk_holidays_user_date", columnNames = {"user_id", "date"}))
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Holiday {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    @JsonIgnore
    private Usuario user;

    @Column(nullable = false)
    private LocalDate date;

    @Column(nullable = false)
    private String name;

    @Column(name = "is_national")
    private Boolean isNational;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @PrePersist
    void prePersist() {
        if (this.createdAt == null) this.createdAt = LocalDateTime.now();
        if (this.isNational == null) this.isNational = false;
    }
}
