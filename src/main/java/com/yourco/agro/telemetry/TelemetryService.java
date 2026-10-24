package com.yourco.agro.telemetry;

import com.yourco.agro.auth.FarmAccess;
import com.yourco.agro.farm.repo.BlockRepository;
import com.yourco.agro.farm.repo.FarmRepository;
import jakarta.transaction.Transactional;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.List;
import java.util.Map;

@Service
public class TelemetryService {
  private final SensorDeviceRepository devices;
  private final SensorReadingRepository readings;
  private final AlertRuleRepository rules;
  private final FarmRepository farms;
  private final BlockRepository blocks;
  private final FarmAccess access;
  private final JdbcTemplate jdbc;

  public TelemetryService(SensorDeviceRepository devices, SensorReadingRepository readings,
                          AlertRuleRepository rules, FarmRepository farms, BlockRepository blocks,
                          FarmAccess access, JdbcTemplate jdbc) {
    this.devices = devices; this.readings = readings; this.rules = rules; this.farms = farms;
    this.blocks = blocks; this.access = access; this.jdbc = jdbc;
  }

  @Transactional
  public SensorDevice createDevice(TelemetryDtos.CreateDeviceRequest request) {
    access.require(request.farmId, true);
    if (devices.existsByDeviceKey(request.deviceKey)) {
      throw new ResponseStatusException(HttpStatus.CONFLICT, "Device key already exists");
    }
    var device = new SensorDevice();
    device.setFarm(farms.findById(request.farmId).orElseThrow());
    if (request.blockId != null) {
      access.require(access.blockFarm(request.blockId), true);
      device.setBlock(blocks.findById(request.blockId).orElseThrow());
    }
    device.setName(request.name); device.setDeviceKey(request.deviceKey);
    return devices.save(device);
  }

  public List<SensorDevice> listDevices(Long farmId) {
    if (farmId != null) access.require(farmId, false);
    var farmIds = farmId == null ? access.farmIds() : List.of(farmId);
    return farmIds.stream().flatMap(id -> devices.findByFarm_Id(id).stream()).toList();
  }

  @Transactional
  public SensorReading ingest(Long deviceId, TelemetryDtos.CreateReadingRequest request) {
    var device = devices.findById(deviceId).orElseThrow();
    access.require(device.getFarm().getId(), false);
    if (request.soilMoisture == null && request.airHumidity == null && request.airTemperature == null && request.soilTemperature == null) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "At least one sensor value is required");
    }
    var reading = new SensorReading(); reading.setDevice(device); reading.setRecordedAt(request.recordedAt);
    reading.setSoilMoisture(request.soilMoisture); reading.setAirHumidity(request.airHumidity);
    reading.setAirTemperature(request.airTemperature); reading.setSoilTemperature(request.soilTemperature);
    var saved = readings.save(reading);
    evaluateAlerts(device, saved);
    return saved;
  }

  public List<SensorReading> readings(Long deviceId, Instant from, Instant to) {
    var device = devices.findById(deviceId).orElseThrow();
    access.require(device.getFarm().getId(), false);
    return readings.findTop100ByDevice_IdAndRecordedAtBetweenOrderByRecordedAtDesc(deviceId,
      from == null ? Instant.EPOCH : from, to == null ? Instant.now() : to);
  }

  @Transactional
  public AlertRule createRule(TelemetryDtos.CreateRuleRequest request) {
    access.require(request.farmId, true);
    if (!List.of("LT", "LTE", "GT", "GTE").contains(request.operator)) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid alert operator");
    if (!List.of("INFO", "WARNING", "CRITICAL").contains(request.severity)) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid alert severity");
    var rule = new AlertRule(); rule.setFarm(farms.findById(request.farmId).orElseThrow()); rule.setMetric(request.metric);
    if (request.blockId != null) { access.require(access.blockFarm(request.blockId), true); rule.setBlock(blocks.findById(request.blockId).orElseThrow()); }
    rule.setOperator(request.operator); rule.setThreshold(request.threshold); rule.setSeverity(request.severity); rule.setMessage(request.message);
    return rules.save(rule);
  }

  public List<Map<String, Object>> alerts(Long farmId, String status) {
    if (farmId != null) access.require(farmId, false);
    var farmIds = farmId == null ? access.farmIds() : List.of(farmId);
    String sql = "SELECT id, rule_id, block_id, metric, value, severity, message, status, created_at FROM sensor_alert WHERE farm_id = ? AND (? IS NULL OR status = ?) ORDER BY created_at DESC";
    return farmIds.stream().flatMap(id -> jdbc.queryForList(sql, id, status, status).stream()).toList();
  }

  @Transactional
  public void acknowledge(Long alertId) {
    Long farmId = jdbc.queryForObject("SELECT farm_id FROM sensor_alert WHERE id = ?", Long.class, alertId);
    access.require(farmId, false);
    jdbc.update("UPDATE sensor_alert SET status = 'ACKNOWLEDGED' WHERE id = ?", alertId);
  }

  private void evaluateAlerts(SensorDevice device, SensorReading reading) {
    for (var rule : rules.findByFarm_IdAndActiveTrue(device.getFarm().getId())) {
      if (rule.getBlock() != null && (device.getBlock() == null || !rule.getBlock().getId().equals(device.getBlock().getId()))) continue;
      Double value = metricValue(rule.getMetric(), reading);
      if (value == null || !matches(rule.getOperator(), value, rule.getThreshold())) continue;
      Long blockId = device.getBlock() == null ? null : device.getBlock().getId();
      jdbc.update("INSERT INTO sensor_alert(rule_id, reading_id, farm_id, block_id, metric, value, severity, message) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        rule.getId(), reading.getId(), device.getFarm().getId(), blockId, rule.getMetric().name(), value, rule.getSeverity(), rule.getMessage());
    }
  }

  private Double metricValue(TelemetryMetric metric, SensorReading reading) {
    return switch (metric) {
      case SOIL_MOISTURE -> reading.getSoilMoisture(); case AIR_HUMIDITY -> reading.getAirHumidity();
      case AIR_TEMPERATURE -> reading.getAirTemperature(); case SOIL_TEMPERATURE -> reading.getSoilTemperature();
    };
  }

  private boolean matches(String operator, double value, double threshold) {
    return switch (operator) { case "LT" -> value < threshold; case "LTE" -> value <= threshold; case "GT" -> value > threshold; case "GTE" -> value >= threshold; default -> false; };
  }
}
