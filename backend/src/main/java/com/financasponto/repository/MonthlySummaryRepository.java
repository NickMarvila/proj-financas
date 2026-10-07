package com.financasponto.repository;

import com.financasponto.entity.MonthlySummary;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;
import java.util.Optional;

public interface MonthlySummaryRepository extends JpaRepository<MonthlySummary, Long> {

    Optional<MonthlySummary> findByUserIdAndMonthAndYear(Long userId, int month, int year);

    List<MonthlySummary> findByUserIdOrderByYearDescMonthDesc(Long userId);

    @Query("SELECT m FROM MonthlySummary m WHERE m.user.id = :userId AND ((m.year < :year) OR (m.year = :year AND m.month < :month)) ORDER BY m.year DESC, m.month DESC")
    List<MonthlySummary> findPreviousMonthsByUserId(@Param("userId") Long userId, @Param("month") int month, @Param("year") int year);
}
