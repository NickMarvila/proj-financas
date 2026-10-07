package com.financasponto.repository;

import com.financasponto.entity.SalaryConfig;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface SalaryConfigRepository extends JpaRepository<SalaryConfig, Long> {
    Optional<SalaryConfig> findFirstByUserIdAndActiveTrueOrderByUpdatedAtDesc(Long userId);
}
