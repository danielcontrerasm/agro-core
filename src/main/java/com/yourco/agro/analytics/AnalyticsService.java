package com.yourco.agro.analytics;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.yourco.agro.auth.FarmAccess;
import com.yourco.agro.inspections.InspectionService;
import com.yourco.agro.fertilization.FertilizationService;
import com.yourco.agro.irrigation.IrrigationService;
import com.yourco.agro.farm.repo.BlockRepository;
import com.yourco.agro.telemetry.SensorDeviceRepository;
import com.yourco.agro.telemetry.SensorReading;
import com.yourco.agro.telemetry.SensorReadingRepository;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.sql.Timestamp;
import java.time.*;
import java.util.*;

@Service
public class AnalyticsService {
  private final BlockRepository blocks;
  private final SensorDeviceRepository devices;
  private final SensorReadingRepository readings;
  private final FarmAccess access;
  private final JdbcTemplate jdbc;
  private final InspectionService inspections;
  private final FertilizationService fertilization;
  private final IrrigationService irrigation;
  private final ObjectMapper json;

  public AnalyticsService(BlockRepository blocks, SensorDeviceRepository devices, SensorReadingRepository readings,
                          FarmAccess access, JdbcTemplate jdbc, InspectionService inspections, FertilizationService fertilization, IrrigationService irrigation, ObjectMapper json) {
    this.blocks = blocks; this.devices = devices; this.readings = readings; this.access = access; this.jdbc = jdbc;
    this.inspections = inspections;
    this.fertilization = fertilization;
    this.irrigation = irrigation;
    this.json = json;
  }

  public Map<String, Object> map(Long farmId, String layer) {
    if (farmId != null) access.require(farmId, false);
    var allowed = farmId == null ? access.farmIds() : List.of(farmId);
    var features = new ArrayList<Map<String, Object>>();
    for (var block : blocks.findAll()) {
      if (!allowed.contains(block.getField().getFarm().getId())) continue;
      var latest = latestForBlock(block.getId(), block.getField().getFarm().getId());
      var values = new LinkedHashMap<String, Object>();
      values.put("blockId", block.getId()); values.put("blockCode", block.getCode()); values.put("crop", block.getCrop());
      values.put("layer", layer == null ? "conditions" : layer);
      var sectors = irrigation.forBlock(block.getId()); values.put("irrigationSectors", sectors);
      Object moisture = null;
      if (sectors.size() == 1 && sectors.get(0).get("latest") instanceof Map<?,?> measurement) moisture = measurement.get("value");
      values.put("soilMoisture", moisture);
      values.put("airHumidity", latest == null ? null : latest.getAirHumidity());
      values.put("airTemperature", latest == null ? null : latest.getAirTemperature());
      values.put("soilTemperature", latest == null ? null : latest.getSoilTemperature());
      var healthStatus = inspections.healthStatus(block.getId(), java.time.LocalDate.now(java.time.ZoneOffset.UTC));
      var yield = jdbc.queryForObject("SELECT COALESCE(SUM(harvested_quantity), 0) FROM crop_monitoring_record WHERE block_id = ? AND record_type = 'HARVEST'", Double.class, block.getId());
      var nutrient = jdbc.queryForMap("""
        SELECT MAX(growth_stage) AS growth_stage,
          COALESCE(SUM(estimated_yield), 0) AS estimated_yield
        FROM crop_monitoring_record WHERE block_id = ? AND record_type = 'HARVEST'
        """, block.getId());
      values.put("healthStatus", healthStatus); values.put("harvestedQuantity", yield);
      values.put("soilAnalysis", fertilization.latestSoil(block.getId())); values.put("growthStage", nutrient.get("growth_stage"));
      values.put("estimatedYield", nutrient.get("estimated_yield")); values.put("areaHa", block.getAreaHa());
      values.put("conditionStatus", sectors.size() == 1 ? sectors.get(0).get("condition") : sectors.isEmpty() ? "NO_DATA" : "MULTIPLE_SECTORS");
      values.put("pestRisk", "NO_DATA");
      var feature = new LinkedHashMap<String, Object>(); feature.put("type", "Feature"); feature.put("geometry", block.getGeom()); feature.put("properties", values); features.add(feature);
    }
    return Map.of("type", "FeatureCollection", "features", features);
  }

  public Map<String, Object> dashboard(Long farmId) {
    access.require(farmId, false);
    var row = jdbc.queryForMap("""
      SELECT COUNT(DISTINCT b.id) AS blocks,
        COALESCE(SUM(CASE WHEN r.record_type = 'FERTILIZER_APPLICATION' THEN r.quantity ELSE 0 END), 0) AS fertilizer_quantity,
        COALESCE(SUM(CASE WHEN r.record_type = 'IRRIGATION' THEN r.water_volume ELSE 0 END), 0) AS water_volume,
        COALESCE(SUM(CASE WHEN r.record_type = 'HARVEST' THEN r.harvested_quantity ELSE 0 END), 0) AS harvested_quantity,
        COUNT(CASE WHEN r.record_type = 'HEALTH_OBSERVATION' THEN 1 END) AS health_observations
      FROM block b JOIN field f ON f.id = b.field_id
      LEFT JOIN crop_monitoring_record r ON r.block_id = b.id OR (r.block_id IS NULL AND r.field_id = f.id)
      WHERE f.farm_id = ?
      """, farmId);
    var result = new LinkedHashMap<String, Object>(); result.putAll(row);
    result.put("openAlerts", jdbc.queryForObject("SELECT COUNT(*) FROM sensor_alert WHERE farm_id = ? AND status = 'OPEN'", Long.class, farmId));
    result.put("connectedDevices", jdbc.queryForObject("SELECT COUNT(*) FROM sensor_device WHERE farm_id = ? AND active = TRUE", Long.class, farmId));
    var water = jdbc.queryForMap("""
      SELECT COALESCE(SUM(CASE WHEN e.volume_mode='METER' THEN e.volume_m3 ELSE 0 END),0) AS measured,
        COALESCE(SUM(CASE WHEN e.volume_mode='FLOW' THEN e.volume_m3 ELSE 0 END),0) AS estimated
      FROM irrigation_execution e JOIN irrigation_plan p ON p.id=e.plan_id
      JOIN irrigation_sector s ON s.id=p.sector_id JOIN block b ON b.id=s.block_id
      JOIN field f ON f.id=b.field_id WHERE f.farm_id=?
      """, farmId);
    result.put("water_volume", water.get("measured")); result.put("estimatedWaterVolumeM3", water.get("estimated"));
    result.put("waterUsageUnit", "m³ measured"); result.put("fertilizerQuantityUnit", "configured unit"); result.put("yieldUnit", "configured unit");
    return result;
  }

  public Map<String, Object> waterUsage(Long farmId, LocalDate from, LocalDate until) {
    access.require(farmId, false);
    LocalDate end = until == null ? LocalDate.now(ZoneOffset.UTC) : until;
    LocalDate start = from == null ? end.minusDays(29) : from;
    if (end.isBefore(start)) throw new ResponseStatusException(org.springframework.http.HttpStatus.BAD_REQUEST, "El final del periodo debe ser posterior al inicio");
    if (start.plusDays(366).isBefore(end)) throw new ResponseStatusException(org.springframework.http.HttpStatus.BAD_REQUEST, "El periodo no puede superar 366 días");

    var sectors = new LinkedHashMap<Long, Map<String, Object>>();
    for (var row : jdbc.queryForList("""
      SELECT s.id AS sector_id,s.details,b.id AS block_id,b.code AS block_code,b.area_ha
      FROM irrigation_sector s JOIN block b ON b.id=s.block_id JOIN field f ON f.id=b.field_id
      WHERE f.farm_id=? ORDER BY b.code,s.id
      """, farmId)) {
      long sectorId = ((Number) row.get("sector_id")).longValue();
      var details = decode(row.get("details"));
      var value = new LinkedHashMap<String, Object>();
      value.put("sectorId", sectorId); value.put("sectorName", Objects.toString(details.get("name"), "Sector " + sectorId));
      value.put("blockId", row.get("block_id")); value.put("blockCode", row.get("block_code")); value.put("areaHa", row.get("area_ha"));
      value.put("moistureUnit", details.get("unit")); value.put("plannedVolumeM3", BigDecimal.ZERO); value.put("actualVolumeM3", BigDecimal.ZERO);
      value.put("measuredVolumeM3", BigDecimal.ZERO); value.put("estimatedVolumeM3", BigDecimal.ZERO); value.put("rainfallMm", BigDecimal.ZERO);
      value.put("requiredVolumeM3", BigDecimal.ZERO); value.put("balanceAppliedVolumeM3", BigDecimal.ZERO); value.put("deficitMm", BigDecimal.ZERO);
      value.put("plannedPlanCount", 0L); value.put("executedPlanCount", 0L); value.put("meteredExecutionCount", 0L); value.put("estimatedExecutionCount", 0L);
      value.put("moistureAverage", null); value.put("moistureReadingCount", 0L); sectors.put(sectorId, value);
    }

    for (var plan : jdbc.queryForList("""
      SELECT p.id,p.sector_id,p.details,p.status
      FROM irrigation_plan p JOIN irrigation_sector s ON s.id=p.sector_id JOIN block b ON b.id=s.block_id JOIN field f ON f.id=b.field_id
      WHERE f.farm_id=?
      """, farmId)) {
      var value = sectors.get(((Number) plan.get("sector_id")).longValue());
      if (value == null || !"SCHEDULED".equals(plan.get("status"))) continue;
      var details = decode(plan.get("details"));
      LocalDate scheduledOn = LocalDate.parse(Objects.toString(details.get("scheduledOn")));
      if (scheduledOn.isBefore(start) || scheduledOn.isAfter(end)) continue;
      add(value, "plannedVolumeM3", details.get("volumeM3")); increment(value, "plannedPlanCount");
    }

    var executedPlans = new HashMap<Long, Set<Long>>();
    for (var execution : jdbc.queryForList("""
      SELECT e.plan_id,e.started_at,e.volume_m3,e.volume_mode,p.sector_id
      FROM irrigation_execution e JOIN irrigation_plan p ON p.id=e.plan_id JOIN irrigation_sector s ON s.id=p.sector_id
      JOIN block b ON b.id=s.block_id JOIN field f ON f.id=b.field_id WHERE f.farm_id=?
      """, farmId)) {
      var value = sectors.get(((Number) execution.get("sector_id")).longValue());
      if (value == null) continue;
      LocalDate executedOn = dateOf(execution.get("started_at"));
      if (executedOn.isBefore(start) || executedOn.isAfter(end)) continue;
      add(value, "actualVolumeM3", execution.get("volume_m3"));
      if ("METER".equals(Objects.toString(execution.get("volume_mode")))) { add(value, "measuredVolumeM3", execution.get("volume_m3")); increment(value, "meteredExecutionCount"); }
      if ("FLOW".equals(Objects.toString(execution.get("volume_mode")))) { add(value, "estimatedVolumeM3", execution.get("volume_m3")); increment(value, "estimatedExecutionCount"); }
      executedPlans.computeIfAbsent(((Number) execution.get("sector_id")).longValue(), ignored -> new HashSet<>()).add(((Number) execution.get("plan_id")).longValue());
    }
    executedPlans.forEach((sectorId, planIds) -> { var value = sectors.get(sectorId); if (value != null) value.put("executedPlanCount", (long) planIds.size()); });

    for (var balance : jdbc.queryForList("""
      SELECT b.sector_id,b.rainfall_mm,b.required_volume_m3,b.applied_volume_m3,b.deficit_mm
      FROM irrigation_water_balance b JOIN irrigation_sector s ON s.id=b.sector_id JOIN block bl ON bl.id=s.block_id JOIN field f ON f.id=bl.field_id
      WHERE f.farm_id=? AND b.balance_date BETWEEN ? AND ?
      """, farmId, start, end)) {
      var value = sectors.get(((Number) balance.get("sector_id")).longValue());
      if (value == null) continue;
      add(value, "rainfallMm", balance.get("rainfall_mm")); add(value, "requiredVolumeM3", balance.get("required_volume_m3"));
      add(value, "balanceAppliedVolumeM3", balance.get("applied_volume_m3")); add(value, "deficitMm", balance.get("deficit_mm"));
    }

    var moistureSums = new HashMap<Long, BigDecimal>();
    var moistureCounts = new HashMap<Long, Long>();
    var periodStart = Timestamp.from(start.atStartOfDay(ZoneOffset.UTC).toInstant());
    var periodEnd = Timestamp.from(end.plusDays(1).atStartOfDay(ZoneOffset.UTC).toInstant());
    for (var reading : jdbc.queryForList("""
      SELECT m.sector_id,m.details FROM irrigation_measurement m JOIN irrigation_sector s ON s.id=m.sector_id JOIN block b ON b.id=s.block_id
      JOIN field f ON f.id=b.field_id WHERE f.farm_id=? AND m.recorded_at>=? AND m.recorded_at<?
      """, farmId, periodStart, periodEnd)) {
      var value = sectors.get(((Number) reading.get("sector_id")).longValue());
      if (value == null) continue;
      var details = decode(reading.get("details"));
      if (details.get("value") == null) continue;
      long sectorId = ((Number) reading.get("sector_id")).longValue();
      moistureSums.merge(sectorId, decimal(details.get("value")), BigDecimal::add); moistureCounts.merge(sectorId, 1L, Long::sum);
    }
    for (var reading : jdbc.queryForList("""
      SELECT s.id AS sector_id,r.soil_moisture FROM irrigation_sector s JOIN sensor_device d ON d.id=s.sensor_device_id
      JOIN sensor_reading r ON r.device_id=d.id JOIN block b ON b.id=s.block_id JOIN field f ON f.id=b.field_id
      WHERE f.farm_id=? AND r.recorded_at>=? AND r.recorded_at<? AND r.soil_moisture IS NOT NULL
      """, farmId, periodStart, periodEnd)) {
      var value = sectors.get(((Number) reading.get("sector_id")).longValue());
      if (value == null) continue;
      long sectorId = ((Number) reading.get("sector_id")).longValue();
      moistureSums.merge(sectorId, decimal(reading.get("soil_moisture")), BigDecimal::add); moistureCounts.merge(sectorId, 1L, Long::sum);
    }
    moistureSums.forEach((sectorId, sum) -> { var value = sectors.get(sectorId); long count = moistureCounts.getOrDefault(sectorId, 0L); value.put("moistureAverage", sum.divide(BigDecimal.valueOf(count), 2, RoundingMode.HALF_UP)); value.put("moistureReadingCount", count); });

    var summary = new LinkedHashMap<String, Object>();
    for (var key : List.of("plannedVolumeM3", "actualVolumeM3", "measuredVolumeM3", "estimatedVolumeM3", "rainfallMm", "requiredVolumeM3", "balanceAppliedVolumeM3", "deficitMm")) summary.put(key, BigDecimal.ZERO);
    for (var value : sectors.values()) {
      for (var key : List.of("plannedVolumeM3", "actualVolumeM3", "measuredVolumeM3", "estimatedVolumeM3", "rainfallMm", "requiredVolumeM3", "balanceAppliedVolumeM3", "deficitMm")) add(summary, key, value.get(key));
      for (var key : List.of("plannedPlanCount", "executedPlanCount", "meteredExecutionCount", "estimatedExecutionCount", "moistureReadingCount")) increment(summary, key, ((Number) value.get(key)).longValue());
    }
    BigDecimal planned = decimal(summary.get("plannedVolumeM3")); BigDecimal actual = decimal(summary.get("actualVolumeM3"));
    BigDecimal required = decimal(summary.get("requiredVolumeM3")); BigDecimal balanceApplied = decimal(summary.get("balanceAppliedVolumeM3"));
    summary.put("varianceM3", actual.subtract(planned)); summary.put("coveragePercent", percent(actual, planned)); summary.put("balanceCoveragePercent", percent(balanceApplied, required)); summary.put("sectorCount", (long) sectors.size());
    for (var value : sectors.values()) {
      BigDecimal sectorPlanned = decimal(value.get("plannedVolumeM3")); BigDecimal sectorActual = decimal(value.get("actualVolumeM3"));
      BigDecimal sectorRequired = decimal(value.get("requiredVolumeM3")); BigDecimal sectorApplied = decimal(value.get("balanceAppliedVolumeM3"));
      value.put("varianceM3", sectorActual.subtract(sectorPlanned)); value.put("coveragePercent", percent(sectorActual, sectorPlanned)); value.put("balanceCoveragePercent", percent(sectorApplied, sectorRequired));
    }

    var result = new LinkedHashMap<String, Object>(); result.put("farmId", farmId); result.put("from", start); result.put("until", end); result.put("summary", summary); result.put("sectors", sectors.values()); return result;
  }

  private Map<String, Object> decode(Object value) {
    try { return json.readValue(Objects.toString(value), new TypeReference<LinkedHashMap<String, Object>>() {}); }
    catch (Exception exception) { throw new IllegalStateException("No se pudo leer un detalle de riego", exception); }
  }

  private LocalDate dateOf(Object value) {
    if (value instanceof LocalDate date) return date;
    if (value instanceof java.sql.Date date) return date.toLocalDate();
    if (value instanceof Timestamp timestamp) return timestamp.toInstant().atZone(ZoneOffset.UTC).toLocalDate();
    if (value instanceof OffsetDateTime date) return date.toInstant().atZone(ZoneOffset.UTC).toLocalDate();
    if (value instanceof Instant instant) return instant.atZone(ZoneOffset.UTC).toLocalDate();
    return LocalDate.parse(value.toString().substring(0, 10));
  }

  private BigDecimal decimal(Object value) { return value == null ? BigDecimal.ZERO : new BigDecimal(value.toString()); }
  private void add(Map<String, Object> target, String key, Object value) { target.put(key, decimal(target.get(key)).add(decimal(value))); }
  private void increment(Map<String, Object> target, String key) { increment(target, key, 1L); }
  private void increment(Map<String, Object> target, String key, long value) { target.put(key, ((Number) target.getOrDefault(key, 0L)).longValue() + value); }
  private BigDecimal percent(BigDecimal numerator, BigDecimal denominator) { return denominator.signum() == 0 ? null : numerator.multiply(BigDecimal.valueOf(100)).divide(denominator, 2, RoundingMode.HALF_UP); }

  private SensorReading latestForBlock(Long blockId, Long farmId) {
    return devices.findByFarm_Id(farmId).stream().filter(device -> device.getBlock() != null && blockId.equals(device.getBlock().getId()))
      .map(device -> readings.findTopByDevice_IdOrderByRecordedAtDesc(device.getId())).filter(Objects::nonNull)
      .max(Comparator.comparing(SensorReading::getRecordedAt)).orElse(null);
  }

}
