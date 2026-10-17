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
}
