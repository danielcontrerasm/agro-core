package com.yourco.agro.telemetry;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface SensorDeviceRepository extends JpaRepository<SensorDevice, Long> {
  List<SensorDevice> findByFarm_Id(Long farmId);
  boolean existsByDeviceKey(String deviceKey);
}
