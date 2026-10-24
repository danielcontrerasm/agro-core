package com.yourco.agro.telemetry;

import org.springframework.data.jpa.repository.JpaRepository;
import java.time.Instant;
import java.util.List;

public interface SensorReadingRepository extends JpaRepository<SensorReading, Long> {
  List<SensorReading> findTop100ByDevice_IdAndRecordedAtBetweenOrderByRecordedAtDesc(Long deviceId, Instant from, Instant to);
  SensorReading findTopByDevice_IdOrderByRecordedAtDesc(Long deviceId);
}
