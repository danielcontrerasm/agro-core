package com.yourco.agro.monitoring;

import com.yourco.agro.farm.entity.Block;
import com.yourco.agro.farm.entity.Field;
import com.yourco.agro.farm.entity.RowLine;
import jakarta.persistence.*;

import java.time.Instant;
import java.time.LocalDate;

@Entity
@Table(name = "crop_monitoring_record")
public class CropMonitoringRecord {
  @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Enumerated(EnumType.STRING)
  @Column(name = "record_type", nullable = false)
  private MonitoringRecordType recordType;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "field_id")
  private Field field;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "block_id")
  private Block block;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "row_id")
  private RowLine row;

  @Column(name = "recorded_at", nullable = false)
  private Instant recordedAt;

  @Column(name = "created_by_user_id", nullable = false)
  private Long createdByUserId;

  @Column(name = "crop_cycle_id")
  private Long cropCycleId;

  private String crop;
  private String variety;
  private LocalDate plantingDate;
  private String growthStage;
  private LocalDate expectedHarvestDate;
  private LocalDate actualHarvestDate;
  private String sampleType;
  private Double ph;
  private Double nitrogen;
  private Double phosphorus;
  private Double potassium;
  private String nutrientDeficiencies;
  private String product;
  private Double dose;
  private String doseUnit;
  private Double quantity;
  private String quantityUnit;
  private Integer irrigationDurationMinutes;
  private Double waterVolume;
  private String waterVolumeUnit;
  private Double soilMoisture;
  private String soilMoistureUnit;
  private String pestOrDisease;
  private Integer severity;
  private String symptoms;
  private String preventiveMeasure;
  private String treatment;
  private LocalDate followUpDate;
  private String resolutionStatus;
  private Double estimatedYield;
  private Double harvestedQuantity;
  private Double harvestedAreaHa;
  private String yieldUnit;
  private String qualityGrade;
  private Double rejectedQuantity;
  private String rejectedReason;
  private String notes;

  @Column(name = "created_at", nullable = false)
  private Instant createdAt = Instant.now();

  public Long getId() { return id; }
  public Long getFieldId() { return field == null ? null : field.getId(); }
  public Long getBlockId() { return block == null ? null : block.getId(); }
  public Long getRowId() { return row == null ? null : row.getId(); }
  public Field getField() { return field; }
  public void setField(Field value) { field = value; }
  public MonitoringRecordType getRecordType() { return recordType; }
  public void setRecordType(MonitoringRecordType value) { recordType = value; }
  public Block getBlock() { return block; }
  public void setBlock(Block value) { block = value; }
  public RowLine getRow() { return row; }
  public void setRow(RowLine value) { row = value; }
  public Instant getRecordedAt() { return recordedAt; }
  public void setRecordedAt(Instant value) { recordedAt = value; }
  public Long getCreatedByUserId() { return createdByUserId; }
  public void setCreatedByUserId(Long value) { createdByUserId = value; }
  public Long getCropCycleId() { return cropCycleId; }
  public void setCropCycleId(Long value) { cropCycleId = value; }
  public String getCrop() { return crop; }
  public void setCrop(String value) { crop = value; }
  public String getVariety() { return variety; }
  public void setVariety(String value) { variety = value; }
  public LocalDate getPlantingDate() { return plantingDate; }
  public void setPlantingDate(LocalDate value) { plantingDate = value; }
  public String getGrowthStage() { return growthStage; }
  public void setGrowthStage(String value) { growthStage = value; }
  public LocalDate getExpectedHarvestDate() { return expectedHarvestDate; }
  public void setExpectedHarvestDate(LocalDate value) { expectedHarvestDate = value; }
  public LocalDate getActualHarvestDate() { return actualHarvestDate; }
  public void setActualHarvestDate(LocalDate value) { actualHarvestDate = value; }
  public String getSampleType() { return sampleType; }
  public void setSampleType(String value) { sampleType = value; }
  public Double getPh() { return ph; }
  public void setPh(Double value) { ph = value; }
  public Double getNitrogen() { return nitrogen; }
  public void setNitrogen(Double value) { nitrogen = value; }
  public Double getPhosphorus() { return phosphorus; }
  public void setPhosphorus(Double value) { phosphorus = value; }
  public Double getPotassium() { return potassium; }
  public void setPotassium(Double value) { potassium = value; }
  public String getNutrientDeficiencies() { return nutrientDeficiencies; }
  public void setNutrientDeficiencies(String value) { nutrientDeficiencies = value; }
  public String getProduct() { return product; }
  public void setProduct(String value) { product = value; }
  public Double getDose() { return dose; }
  public void setDose(Double value) { dose = value; }
  public String getDoseUnit() { return doseUnit; }
  public void setDoseUnit(String value) { doseUnit = value; }
  public Double getQuantity() { return quantity; }
  public void setQuantity(Double value) { quantity = value; }
  public String getQuantityUnit() { return quantityUnit; }
  public void setQuantityUnit(String value) { quantityUnit = value; }
  public Integer getIrrigationDurationMinutes() { return irrigationDurationMinutes; }
  public void setIrrigationDurationMinutes(Integer value) { irrigationDurationMinutes = value; }
  public Double getWaterVolume() { return waterVolume; }
  public void setWaterVolume(Double value) { waterVolume = value; }
  public String getWaterVolumeUnit() { return waterVolumeUnit; }
  public void setWaterVolumeUnit(String value) { waterVolumeUnit = value; }
  public Double getSoilMoisture() { return soilMoisture; }
  public void setSoilMoisture(Double value) { soilMoisture = value; }
  public String getSoilMoistureUnit() { return soilMoistureUnit; }
  public void setSoilMoistureUnit(String value) { soilMoistureUnit = value; }
  public String getPestOrDisease() { return pestOrDisease; }
  public void setPestOrDisease(String value) { pestOrDisease = value; }
  public Integer getSeverity() { return severity; }
  public void setSeverity(Integer value) { severity = value; }
  public String getSymptoms() { return symptoms; }
  public void setSymptoms(String value) { symptoms = value; }
  public String getPreventiveMeasure() { return preventiveMeasure; }
  public void setPreventiveMeasure(String value) { preventiveMeasure = value; }
  public String getTreatment() { return treatment; }
  public void setTreatment(String value) { treatment = value; }
  public LocalDate getFollowUpDate() { return followUpDate; }
  public void setFollowUpDate(LocalDate value) { followUpDate = value; }
  public String getResolutionStatus() { return resolutionStatus; }
  public void setResolutionStatus(String value) { resolutionStatus = value; }
  public Double getEstimatedYield() { return estimatedYield; }
  public void setEstimatedYield(Double value) { estimatedYield = value; }
  public Double getHarvestedQuantity() { return harvestedQuantity; }
  public void setHarvestedQuantity(Double value) { harvestedQuantity = value; }
  public Double getHarvestedAreaHa() { return harvestedAreaHa; }
  public void setHarvestedAreaHa(Double value) { harvestedAreaHa = value; }
  public String getYieldUnit() { return yieldUnit; }
  public void setYieldUnit(String value) { yieldUnit = value; }
  public String getQualityGrade() { return qualityGrade; }
  public void setQualityGrade(String value) { qualityGrade = value; }
  public Double getRejectedQuantity() { return rejectedQuantity; }
  public void setRejectedQuantity(Double value) { rejectedQuantity = value; }
  public String getRejectedReason() { return rejectedReason; }
  public void setRejectedReason(String value) { rejectedReason = value; }
  public String getNotes() { return notes; }
  public void setNotes(String value) { notes = value; }
  public Instant getCreatedAt() { return createdAt; }
}
