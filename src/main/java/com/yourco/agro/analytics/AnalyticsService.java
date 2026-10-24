package com.yourco.agro.analytics;

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

  public AnalyticsService(BlockRepository blocks, SensorDeviceRepository devices, SensorReadingRepository readings,
                          FarmAccess access, JdbcTemplate jdbc, InspectionService inspections, FertilizationService fertilization, IrrigationService irrigation) {
    this.blocks = blocks; this.devices = devices; this.readings = readings; this.access = access; this.jdbc = jdbc;
    this.inspections = inspections;
    this.fertilization = fertilization;
    this.irrigation = irrigation;
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
        FROM crop_monitoring_record WHERE block_id = ?
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
      LEFT JOIN crop_monitoring_record r ON r.block_id = b.id
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

  private SensorReading latestForBlock(Long blockId, Long farmId) {
    return devices.findByFarm_Id(farmId).stream().filter(device -> device.getBlock() != null && blockId.equals(device.getBlock().getId()))
      .map(device -> readings.findTopByDevice_IdOrderByRecordedAtDesc(device.getId())).filter(Objects::nonNull)
      .max(Comparator.comparing(SensorReading::getRecordedAt)).orElse(null);
  }

}
