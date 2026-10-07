package com.financasponto.repository;

import com.financasponto.entity.Expense;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;
import java.util.Optional;

public interface ExpenseRepository extends JpaRepository<Expense, Long> {

    List<Expense> findByUserIdAndActiveTrueOrderByNameAsc(Long userId);

    Optional<Expense> findByIdAndUserId(Long id, Long userId);

    // Recorrentes ativas + pontuais do mês
    @Query("SELECT e FROM Expense e WHERE e.user.id = :userId AND e.active = true AND (e.recurring = true OR (e.month = :month AND e.year = :year))")
    List<Expense> findActiveForMonthByUserId(@Param("userId") Long userId, @Param("month") int month, @Param("year") int year);
}
