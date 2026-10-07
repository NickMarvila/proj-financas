package com.financasponto.repository;

import com.financasponto.entity.WorkDay;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface WorkDayRepository extends JpaRepository<WorkDay, Long> {

    Optional<WorkDay> findByUserIdAndDate(Long userId, LocalDate date);

    List<WorkDay> findByUserIdAndDateBetweenOrderByDateDesc(Long userId, LocalDate start, LocalDate end);

    @Query("SELECT w FROM WorkDay w WHERE w.user.id = :userId AND YEAR(w.date) = :year AND MONTH(w.date) = :month ORDER BY w.date ASC")
    List<WorkDay> findByUserIdAndYearAndMonth(@Param("userId") Long userId, @Param("year") int year, @Param("month") int month);

    @Query("SELECT COALESCE(SUM(w.overtimeMinutes), 0) FROM WorkDay w WHERE w.user.id = :userId AND w.date >= :start AND w.date <= :end")
    Integer sumOvertimeMinutesByUserIdAndDateBetween(@Param("userId") Long userId, @Param("start") LocalDate start, @Param("end") LocalDate end);

    @Query("SELECT COALESCE(SUM(w.overtimeMinutes), 0) FROM WorkDay w WHERE w.user.id = :userId AND YEAR(w.date) = :year AND MONTH(w.date) = :month")
    Integer sumOvertimeMinutesByUserIdAndYearAndMonth(@Param("userId") Long userId, @Param("year") int year, @Param("month") int month);

    @Query("SELECT COUNT(w) FROM WorkDay w WHERE w.user.id = :userId AND w.isSaturday = true AND w.workedMinutes > 0 AND w.date >= :start AND w.date <= :end")
    long countWorkedSaturdaysInCycle(@Param("userId") Long userId, @Param("start") LocalDate start, @Param("end") LocalDate end);

    @Query("SELECT COUNT(w) FROM WorkDay w WHERE w.user.id = :userId AND w.isSaturday = true AND w.workedMinutes > 0 AND YEAR(w.date) = :year AND MONTH(w.date) = :month")
    long countWorkedSaturdaysInMonth(@Param("userId") Long userId, @Param("year") int year, @Param("month") int month);
}
