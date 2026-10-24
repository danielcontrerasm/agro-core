package com.yourco.agro.monitoring;

import com.yourco.agro.auth.FarmAccess;
import com.yourco.agro.farm.repo.BlockRepository;
import com.yourco.agro.farm.repo.RowRepository;
import jakarta.transaction.Transactional;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;

import java.time.Instant;

@Service
public class CropMonitoringRecordService {
  private final CropMonitoringRecordRepository records;
  private final BlockRepository blocks;
  private final RowRepository rows;
  private final FarmAccess access;

  public CropMonitoringRecordService(CropMonitoringRecordRepository records, BlockRepository blocks,
                                     RowRepository rows, FarmAccess access) {
    this.records = records;
    this.blocks = blocks;
    this.rows = rows;
    this.access = access;
  }

  @Transactional
  public CropMonitoringRecord create(CropMonitoringRecordDtos.CreateRequest request) {
    access.require(access.blockFarm(request.blockId), false);
    var block = blocks.findById(request.blockId).orElseThrow();
    var record = new CropMonitoringRecord();
    record.setRecordType(request.recordType);
    record.setBlock(block);
    record.setRecordedAt(request.recordedAt);
    record.setCreatedByUserId(access.userId());
    if (request.rowId != null) {
      access.require(access.rowFarm(request.rowId), false);
      var row = rows.findById(request.rowId).orElseThrow();
      if (!row.getBlock().getId().equals(request.blockId)) {
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Row must belong to the specified block");
      }
      record.setRow(row);
    }
    copy(request, record);
    return records.save(record);
  }

  private void copy(CropMonitoringRecordDtos.CreateRequest request, CropMonitoringRecord record) {
    record.setCrop(request.crop); record.setVariety(request.variety); record.setPlantingDate(request.plantingDate);
    record.setGrowthStage(request.growthStage); record.setExpectedHarvestDate(request.expectedHarvestDate);
    record.setActualHarvestDate(request.actualHarvestDate); record.setSampleType(request.sampleType);
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
    record.setYieldUnit(request.yieldUnit); record.setQualityGrade(request.qualityGrade);
    record.setRejectedQuantity(request.rejectedQuantity); record.setNotes(request.notes);
  }

  public java.util.List<CropMonitoringRecord> search(Long blockId, MonitoringRecordType type, Instant from, Instant to) {
    if (blockId != null) access.require(access.blockFarm(blockId), false);
    var farms = access.farmIds();
    return records.search(blockId, type, from, to).stream()
      .filter(record -> farms.contains(access.blockFarm(record.getBlock().getId()))).toList();
  }
}
