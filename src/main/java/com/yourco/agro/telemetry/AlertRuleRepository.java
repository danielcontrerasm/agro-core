package com.yourco.agro.telemetry;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface AlertRuleRepository extends JpaRepository<AlertRule, Long> {
  List<AlertRule> findByFarm_IdAndActiveTrue(Long farmId);
}
