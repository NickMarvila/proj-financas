package com.financasponto.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;
import com.fasterxml.jackson.annotation.JsonIgnore;

@Entity
@Table(name = "time_records")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TimeRecord {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id")
    @JsonIgnore
    private Usuario user;

    @Column(nullable = false)
    private LocalDateTime timestamp;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private PunchType punchType; // IN ou OUT

    private String origin; // FACE, MANUAL, etc.

    private Boolean online;

    @Column(length = 500)
    private String hash;

    @Column(name = "email_message_id", unique = true)
    private String emailMessageId;

    @Column(name = "raw_text", columnDefinition = "TEXT")
    private String rawText;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @PrePersist
    void prePersist() {
        this.createdAt = LocalDateTime.now();
    }

    public enum PunchType {
        IN, OUT
    }
}
