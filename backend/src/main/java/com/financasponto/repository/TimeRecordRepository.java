package com.financasponto.repository;

import com.financasponto.entity.TimeRecord;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface TimeRecordRepository extends JpaRepository<TimeRecord, Long> {

    Optional<TimeRecord> findByEmailMessageId(String emailMessageId);

    List<TimeRecord> findByUserIdAndTimestampBetweenOrderByTimestampAsc(Long userId, LocalDateTime start, LocalDateTime end);

    @Query("SELECT t FROM TimeRecord t WHERE t.user.id = :userId AND FUNCTION('DATE', t.timestamp) = FUNCTION('DATE', :date) ORDER BY t.timestamp ASC")
    List<TimeRecord> findByUserIdAndDate(@Param("userId") Long userId, @Param("date") LocalDateTime date);

    @Query("SELECT t FROM TimeRecord t WHERE t.user.id = :userId AND YEAR(t.timestamp) = :year AND MONTH(t.timestamp) = :month ORDER BY t.timestamp ASC")
    List<TimeRecord> findByUserIdAndYearAndMonth(@Param("userId") Long userId, @Param("year") int year, @Param("month") int month);

    @Query("SELECT COUNT(t) FROM TimeRecord t WHERE t.user.id = :userId AND FUNCTION('DATE', t.timestamp) = FUNCTION('DATE', :date)")
    long countByUserIdAndDate(@Param("userId") Long userId, @Param("date") LocalDateTime date);
}
