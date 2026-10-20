package com.financasponto.repository;

import com.financasponto.entity.Holiday;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Repository
public interface HolidayRepository extends JpaRepository<Holiday, Long> {

    List<Holiday> findByUserIdOrderByDateAsc(Long userId);

    List<Holiday> findByUserIdAndDateBetweenOrderByDateAsc(Long userId, LocalDate start, LocalDate end);

    Optional<Holiday> findByUserIdAndDate(Long userId, LocalDate date);

    boolean existsByUserIdAndDate(Long userId, LocalDate date);

    void deleteByUserIdAndDate(Long userId, LocalDate date);
}
