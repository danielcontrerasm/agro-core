package com.yourco.agro.monitoring;

import com.yourco.agro.auth.FarmAccess;
import com.yourco.agro.farm.entity.Block;
import com.yourco.agro.farm.entity.Field;
import com.yourco.agro.farm.entity.RowLine;
import com.yourco.agro.farm.repo.BlockRepository;
import com.yourco.agro.farm.repo.FieldRepository;
import com.yourco.agro.farm.repo.RowRepository;
import jakarta.transaction.Transactional;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import java.util.Objects;

@Service
public class CropMonitoringRecordService {
  private final CropMonitoringRecordRepository records;
  private final FieldRepository fields;
  private final BlockRepository blocks;
  private final RowRepository rows;
  private final FarmAccess access;
  private final JdbcTemplate jdbc;

  public CropMonitoringRecordService(CropMonitoringRecordRepository records, FieldRepository fields,
                                     BlockRepository blocks, RowRepository rows, FarmAccess access,
                                     JdbcTemplate jdbc) {
    this.records = records;
    this.fields = fields;
    this.blocks = blocks;
    this.rows = rows;
    this.access = access;
    this.jdbc = jdbc;
  }

  @Transactional
  public CropMonitoringRecord create(CropMonitoringRecordDtos.CreateRequest request) {
    var location = resolveLocation(request);
    access.require(location.field().getFarm().getId(), false);
    var cycle = resolveCycle(request.cropCycleId, location);
    var normalizedUnit = request.recordType == MonitoringRecordType.HARVEST
      ? validateHarvest(request, cycle)
      : request.yieldUnit;
    var normalizedQuality = request.recordType == MonitoringRecordType.HARVEST
      ? ProductionRecordRules.quality(request.qualityGrade)
      : request.qualityGrade;
    var record = new CropMonitoringRecord();
    record.setRecordType(request.recordType);
    record.setField(location.field());
    record.setBlock(location.block());
    record.setRow(location.row());
    record.setCropCycleId(cycle == null ? null : ((Number) cycle.get("id")).longValue());
    record.setRecordedAt(request.recordedAt);
    record.setCreatedByUserId(access.userId());
    copy(request, record, cycle, normalizedUnit, normalizedQuality);
    return records.save(record);
  }

  @Transactional
  public CropMonitoringRecord update(Long id, CropMonitoringRecordDtos.CreateRequest request) {
    var record = records.findById(id).orElseThrow(() -> notFound("Registro no encontrado"));
    var farmId = access.monitoringRecordFarm(id);
    access.require(farmId, false);
    if (record.getRecordType() != request.recordType) {
      throw bad("No se puede cambiar el tipo de registro");
    }
    var location = resolveLocation(request);
    access.require(location.field().getFarm().getId(), false);
    if (!Objects.equals(farmId, location.field().getFarm().getId())) {
      throw bad("La ubicación debe pertenecer a la misma finca del registro");
    }
    var cycle = resolveCycle(request.cropCycleId, location);
    var normalizedUnit = request.recordType == MonitoringRecordType.HARVEST
      ? validateHarvest(request, cycle)
      : request.yieldUnit;
    var normalizedQuality = request.recordType == MonitoringRecordType.HARVEST
      ? ProductionRecordRules.quality(request.qualityGrade)
      : request.qualityGrade;
    record.setField(location.field());
    record.setBlock(location.block());
    record.setRow(location.row());
    record.setCropCycleId(cycle == null ? null : ((Number) cycle.get("id")).longValue());
    record.setRecordedAt(request.recordedAt);
    copy(request, record, cycle, normalizedUnit, normalizedQuality);
    return records.save(record);
  }

  private Location resolveLocation(CropMonitoringRecordDtos.CreateRequest request) {
    Field field = request.fieldId == null ? null : fields.findById(request.fieldId).orElseThrow(() -> notFound("Campo no encontrado"));
    Block block = request.blockId == null ? null : blocks.findById(request.blockId).orElseThrow(() -> notFound("Bloque no encontrado"));
    RowLine row = request.rowId == null ? null : rows.findById(request.rowId).orElseThrow(() -> notFound("Fila no encontrada"));

    if (row != null) {
      if (block != null && !Objects.equals(block.getId(), row.getBlock().getId())) throw bad("La fila no pertenece al bloque indicado");
      block = row.getBlock();
    }
    if (block != null) {
      if (field != null && !Objects.equals(field.getId(), block.getField().getId())) throw bad("El bloque no pertenece al campo indicado");
      field = block.getField();
    }
    if (field == null) throw bad("Indica un campo, bloque o fila");
    if (request.recordType != MonitoringRecordType.HARVEST && block == null) throw bad("Los registros de monitoreo requieren un bloque");
    return new Location(field, block, row);
  }

  private Map<String, Object> resolveCycle(Long cycleId, Location location) {
    var matches = cycleId == null && location.block() != null
      ? jdbc.queryForList("""
        SELECT c.*, b.field_id AS cycle_field_id
        FROM crop_cycle c JOIN block b ON b.id = c.block_id
        WHERE c.block_id = ? AND c.status NOT IN ('CANCELED', 'CLOSED')
        ORDER BY c.id DESC
        """, location.block().getId())
      : jdbc.queryForList("""
      SELECT c.*, b.field_id AS cycle_field_id
      FROM crop_cycle c JOIN block b ON b.id = c.block_id
      WHERE c.id = ?
      """, cycleId);
    if (cycleId == null && matches.size() != 1) return null;
    if (matches.isEmpty()) throw notFound("Ciclo de cultivo no encontrado");
    var cycle = matches.get(0);
    if (!Objects.equals(((Number) cycle.get("cycle_field_id")).longValue(), location.field().getId())) {
      throw bad("El ciclo no pertenece al campo indicado");
    }
    if (location.block() != null && !Objects.equals(((Number) cycle.get("block_id")).longValue(), location.block().getId())) {
      throw bad("El ciclo no pertenece al bloque indicado");
    }
    if (location.row() != null && cycle.get("row_id") != null &&
        !Objects.equals(((Number) cycle.get("row_id")).longValue(), location.row().getId())) {
      throw bad("El ciclo no pertenece a la fila indicada");
    }
    return cycle;
  }

  private String validateHarvest(CropMonitoringRecordDtos.CreateRequest request, Map<String, Object> cycle) {
    if (request.harvestedQuantity == null || request.harvestedQuantity < 0) throw bad("La cantidad cosechada es obligatoria y no puede ser negativa");
    if (request.harvestedAreaHa != null && request.harvestedAreaHa <= 0) throw bad("El área cosechada debe ser mayor que cero");
    if (request.estimatedYield != null && request.estimatedYield < 0) throw bad("El rendimiento estimado no puede ser negativo");
    if (request.rejectedQuantity != null && request.rejectedQuantity < 0) throw bad("La cantidad rechazada no puede ser negativa");
    if (request.rejectedQuantity != null && request.rejectedQuantity > 0 &&
        (request.rejectedReason == null || request.rejectedReason.isBlank())) {
      throw bad("Indica el motivo de la cantidad rechazada");
    }
    if (request.actualHarvestDate != null && request.actualHarvestDate.isAfter(LocalDate.now(ZoneOffset.UTC))) {
      throw bad("La fecha de cosecha no puede estar en el futuro");
    }
    if (request.yieldUnit == null || request.yieldUnit.isBlank()) throw bad("La unidad de rendimiento es obligatoria");
    if (request.qualityGrade == null || request.qualityGrade.isBlank()) throw bad("El grado de calidad es obligatorio");
    if (cycle == null && request.cropCycleId != null) throw bad("El ciclo de cultivo no es válido");
    return ProductionRecordRules.unit(request.yieldUnit);
  }

  private void copy(CropMonitoringRecordDtos.CreateRequest request, CropMonitoringRecord record,
                    Map<String, Object> cycle, String normalizedUnit, String normalizedQuality) {
    record.setCrop(request.crop != null ? request.crop : cycle == null ? null : (String) cycle.get("crop"));
    record.setVariety(request.variety != null ? request.variety : cycle == null ? null : (String) cycle.get("variety"));
    record.setPlantingDate(request.plantingDate);
    record.setGrowthStage(request.growthStage); record.setExpectedHarvestDate(request.expectedHarvestDate == null && cycle != null && cycle.get("expected_harvest_on") != null
      ? ((java.sql.Date) cycle.get("expected_harvest_on")).toLocalDate() : request.expectedHarvestDate);
    record.setActualHarvestDate(request.actualHarvestDate == null && request.recordType == MonitoringRecordType.HARVEST
      ? request.recordedAt.atZone(ZoneOffset.UTC).toLocalDate() : request.actualHarvestDate);
    record.setSampleType(request.sampleType);
    record.setPh(request.ph); record.setNitrogen(request.nitrogen); record.setPhosphorus(request.phosphorus);
    record.setPotassium(request.potassium); record.setNutrientDeficiencies(request.nutrientDeficiencies);
    record.setProduct(request.product); record.setDose(request.dose); record.setDoseUnit(request.doseUnit);
    record.setQuantity(request.quantity); record.setQuantityUnit(request.quantityUnit);
    record.setIrrigationDurationMinutes(request.irrigationDurationMinutes); record.setWaterVolume(request.waterVolume);
    record.setWaterVolumeUnit(request.waterVolumeUnit); record.setSoilMoisture(request.soilMoisture);
    record.setSoilMoistureUnit(request.soilMoistureUnit); record.setPestOrDisease(request.pestOrDisease);
    record.setSeverity(request.severity); record.setSymptoms(request.symptoms);
    record.setPreventiveMeasure(request.preventiveMeasure); record.setTreatment(request.treatment);
    record.setFollowUpDate(request.followUpDate); record.setResolutionStatus(request.resolutionStatus);
    record.setEstimatedYield(request.estimatedYield); record.setHarvestedQuantity(request.harvestedQuantity);
    record.setHarvestedAreaHa(request.harvestedAreaHa); record.setYieldUnit(normalizedUnit);
    record.setQualityGrade(normalizedQuality); record.setRejectedQuantity(request.rejectedQuantity);
    record.setRejectedReason(request.rejectedReason); record.setNotes(request.notes);
  }

  public List<CropMonitoringRecord> search(Long farmId, Long blockId, Long fieldId, Long cropCycleId,
                                           MonitoringRecordType type, Instant from, Instant to) {
    if (farmId != null) access.require(farmId, false);
    if (blockId != null) access.require(access.blockFarm(blockId), false);
    if (fieldId != null) access.require(access.fieldFarm(fieldId), false);
    var farms = farmId == null ? access.farmIds() : List.of(farmId);
    return records.search(blockId, fieldId, cropCycleId, type, from, to).stream()
      .filter(record -> {
        var field = record.getField();
        var block = record.getBlock();
        var recordFarmId = field != null ? field.getFarm().getId() : block == null ? null : block.getField().getFarm().getId();
        return recordFarmId != null && farms.contains(recordFarmId);
      }).toList();
  }

  public CropMonitoringRecord get(Long id) {
    var record = records.findById(id).orElseThrow(() -> notFound("Registro no encontrado"));
    access.require(access.monitoringRecordFarm(id), false);
    return record;
  }

  @Transactional
  public void delete(Long id) {
    var record = records.findById(id).orElseThrow(() -> notFound("Registro no encontrado"));
    access.requireAgronomic(access.monitoringRecordFarm(id));
    records.delete(record);
  }

  private ResponseStatusException bad(String message) {
    return ProductionRecordRules.bad(message);
  }

  private ResponseStatusException notFound(String message) {
    return new ResponseStatusException(HttpStatus.NOT_FOUND, message);
  }

  private record Location(Field field, Block block, RowLine row) {}
}
