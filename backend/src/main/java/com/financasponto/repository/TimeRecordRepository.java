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

    List<TimeRecord> findByTimestampBetweenOrderByTimestampAsc(LocalDateTime start, LocalDateTime end);

    @Query("SELECT t FROM TimeRecord t WHERE FUNCTION('DATE', t.timestamp) = FUNCTION('DATE', :date) ORDER BY t.timestamp ASC")
    List<TimeRecord> findByDate(@Param("date") LocalDateTime date);

    @Query("SELECT t FROM TimeRecord t WHERE YEAR(t.timestamp) = :year AND MONTH(t.timestamp) = :month ORDER BY t.timestamp ASC")
    List<TimeRecord> findByYearAndMonth(@Param("year") int year, @Param("month") int month);

    @Query("SELECT COUNT(t) FROM TimeRecord t WHERE FUNCTION('DATE', t.timestamp) = FUNCTION('DATE', :date)")
    long countByDate(@Param("date") LocalDateTime date);
}
