package com.yourco.agro.monitoring;

import jakarta.validation.constraints.NotNull;

import java.time.Instant;
import java.time.LocalDate;

public final class CropMonitoringRecordDtos {
  private CropMonitoringRecordDtos() {}

  public static class CreateRequest {
    @NotNull public MonitoringRecordType recordType;
    public Long fieldId;
    public Long blockId;
    public Long rowId;
    public Long cropCycleId;
    @NotNull public Instant recordedAt;
    public String crop;
    public String variety;
    public LocalDate plantingDate;
    public String growthStage;
    public LocalDate expectedHarvestDate;
    public LocalDate actualHarvestDate;
    public String sampleType;
    public Double ph;
    public Double nitrogen;
    public Double phosphorus;
    public Double potassium;
    public String nutrientDeficiencies;
    public String product;
    public Double dose;
    public String doseUnit;
    public Double quantity;
    public String quantityUnit;
    public Integer irrigationDurationMinutes;
    public Double waterVolume;
    public String waterVolumeUnit;
    public Double soilMoisture;
    public String soilMoistureUnit;
    public String pestOrDisease;
    public Integer severity;
    public String symptoms;
    public String preventiveMeasure;
    public String treatment;
    public LocalDate followUpDate;
    public String resolutionStatus;
    public Double estimatedYield;
    public Double harvestedQuantity;
    public Double harvestedAreaHa;
    public String yieldUnit;
    public String qualityGrade;
    public Double rejectedQuantity;
    public String rejectedReason;
    public String notes;
  }
}
