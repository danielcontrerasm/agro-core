package com.yourco.agro.irrigation;

import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.time.*;

public class IrrigationDtos {
  public enum WaterSourceType { WELL, RESERVOIR, CANAL, RIVER, RAINWATER, OTHER }
  public enum AssetType { PUMP, VALVE, PIPE, FILTER, METER, DRAIN, CANAL, RESERVOIR, OTHER }
  public enum AssetStatus { ACTIVE, INACTIVE, MAINTENANCE }
  public enum MaintenanceType { FILTER_WASH, PUMP_CHECK, VALVE_CHECK, LEAK_REPAIR, METER_CALIBRATION, DRAIN_CLEANING, OTHER }
  public enum MaintenanceStatus { PLANNED, IN_PROGRESS, COMPLETED, BLOCKED }
  public enum CalibrationStatus { VALID, DUE, FAILED }
  public enum MoistureUnit { VWC_PERCENT, GRAV_PERCENT, KPA }
  public enum VolumeMode { METER, FLOW }
  public enum VolumeUnit { L, M3 }
  public record Sector(@NotNull Long blockId, @NotBlank @Size(max=100) String name,
    @NotNull @DecimalMin(value="0",inclusive=false) @DecimalMax("1000000") BigDecimal areaHa,
    @NotBlank @Size(max=150) String system, @NotBlank @Size(max=150) String waterSource,
    @DecimalMin(value="0",inclusive=false) @DecimalMax("1000000") BigDecimal flowM3h,
    @NotNull MoistureUnit unit, @NotNull @Min(1) @Max(300) Integer depthCm,
    Long sensorDeviceId, @DecimalMin("0") @DecimalMax("1000000") BigDecimal lowerBound,
    @DecimalMin("0") @DecimalMax("1000000") BigDecimal upperBound,
    @NotNull @Min(1) @Max(720) Integer maxAgeHours,
    @NotBlank @Size(max=2000) String technicalBasis) {}
  public record Thresholds(@NotNull @Min(0) Long version,
    @DecimalMin("0") @DecimalMax("1000000") BigDecimal lowerBound,
    @DecimalMin("0") @DecimalMax("1000000") BigDecimal upperBound,
    @NotNull @Min(1) @Max(720) Integer maxAgeHours,
    @NotBlank @Size(max=2000) String technicalBasis) {}
  public record Measurement(@NotNull Long sectorId, @NotNull @PastOrPresent Instant recordedAt,
    @NotNull @DecimalMin("0") @DecimalMax("1000000") BigDecimal value,
    @NotNull MoistureUnit unit, @NotNull @Min(1) @Max(300) Integer depthCm,
    @NotBlank @Size(max=200) String instrument,
    @DecimalMin("0") @DecimalMax("10000") BigDecimal rainMm,
    @Size(max=1000) String drainage, @Size(max=2000) String notes) {}
  public record Plan(@NotNull Long sectorId, @NotNull LocalDate scheduledOn, @NotNull LocalTime scheduledTime,
    @NotNull @DecimalMin(value="0",inclusive=false) @DecimalMax("43200") @Digits(integer=5,fraction=6) BigDecimal durationMinutes,
    @NotNull @DecimalMin(value="0",inclusive=false) @DecimalMax("1000000000") @Digits(integer=10,fraction=6) BigDecimal volumeM3,
    @NotNull Long assigneeId, @NotBlank @Size(max=2000) String justification,
    @NotBlank @Size(max=1000) String instructions) {}
  public record Cancel(@NotNull @Min(0) Long version, @NotBlank @Size(max=2000) String reason) {}
  public record Execution(@NotNull @PastOrPresent Instant startedAt, @NotNull @PastOrPresent Instant endedAt,
    @NotNull @DecimalMin("0") @DecimalMax("43200") @Digits(integer=5,fraction=6) BigDecimal interruptionMinutes,
    @NotNull VolumeMode volumeMode, VolumeUnit meterUnit,
    @DecimalMin("0") @DecimalMax("1000000000000") BigDecimal meterStart,
    @DecimalMin("0") @DecimalMax("1000000000000") BigDecimal meterEnd,
    @DecimalMin(value="0",inclusive=false) @DecimalMax("1000000") BigDecimal flowM3h,
    @Size(max=2000) String varianceReason, @Size(max=2000) String notes) {}
  public record WaterSource(@NotNull Long farmId, @NotBlank @Size(max=150) String name, @NotNull WaterSourceType sourceType,
    @DecimalMin("-90") @DecimalMax("90") BigDecimal latitude, @DecimalMin("-180") @DecimalMax("180") BigDecimal longitude,
    @DecimalMin("0") BigDecimal capacityM3, @Size(max=2000) String notes) {}
  public record WaterSourceUpdate(@NotBlank @Size(max=150) String name, @NotNull WaterSourceType sourceType,
    @DecimalMin("-90") @DecimalMax("90") BigDecimal latitude, @DecimalMin("-180") @DecimalMax("180") BigDecimal longitude,
    @DecimalMin("0") BigDecimal capacityM3, @NotNull Boolean active, @Size(max=2000) String notes,
    @NotNull @Min(0) Long version) {}
  public record WaterQuality(@NotNull @PastOrPresent LocalDate sampledOn, @DecimalMin("0") @DecimalMax("14") BigDecimal ph,
    @DecimalMin("0") BigDecimal conductivityDsM, @DecimalMin("0") BigDecimal salinityPpm,
    @DecimalMin("0") BigDecimal suspendedSolidsMgL, @Size(max=300) String laboratoryReference, @Size(max=2000) String notes) {}
  public record WaterQualityUpdate(@NotNull Long sourceId, @NotNull @PastOrPresent LocalDate sampledOn,
    @DecimalMin("0") @DecimalMax("14") BigDecimal ph, @DecimalMin("0") BigDecimal conductivityDsM,
    @DecimalMin("0") BigDecimal salinityPpm, @DecimalMin("0") BigDecimal suspendedSolidsMgL,
    @Size(max=300) String laboratoryReference, @Size(max=2000) String notes,
    @NotNull @Min(0) Long version) {}
  public record Infrastructure(@NotNull Long farmId, Long blockId, Long sourceId, @NotNull AssetType assetType,
    @NotBlank @Size(max=100) String code, @DecimalMin("-90") @DecimalMax("90") BigDecimal latitude,
    @DecimalMin("-180") @DecimalMax("180") BigDecimal longitude, @NotNull AssetStatus status, @Size(max=2000) String notes) {}
  public record InfrastructureUpdate(Long blockId, Long sourceId, @NotNull AssetType assetType,
    @NotBlank @Size(max=100) String code, @DecimalMin("-90") @DecimalMax("90") BigDecimal latitude,
    @DecimalMin("-180") @DecimalMax("180") BigDecimal longitude, @NotNull AssetStatus status,
    @Size(max=2000) String notes, @NotNull @Min(0) Long version) {}
  public record WaterBalance(@NotNull Long sectorId, @NotNull @PastOrPresent LocalDate balanceDate,
    @NotNull @DecimalMin("0") BigDecimal rainfallMm, @DecimalMin("0") BigDecimal et0Mm,
    @DecimalMin("0") BigDecimal cropCoefficient, @DecimalMin(value="0", inclusive=false) BigDecimal rootDepthCm,
    @DecimalMin("0") BigDecimal availableWaterMm, @DecimalMin("0") BigDecimal requiredVolumeM3,
    @DecimalMin("0") BigDecimal appliedVolumeM3, @DecimalMin("0") BigDecimal deficitMm, @Size(max=2000) String notes) {}
  public record WaterBalanceUpdate(@NotNull Long sectorId, @NotNull @PastOrPresent LocalDate balanceDate,
    @NotNull @DecimalMin("0") BigDecimal rainfallMm, @DecimalMin("0") BigDecimal et0Mm,
    @DecimalMin("0") BigDecimal cropCoefficient, @DecimalMin(value="0", inclusive=false) BigDecimal rootDepthCm,
    @DecimalMin("0") BigDecimal availableWaterMm, @DecimalMin("0") BigDecimal requiredVolumeM3,
    @DecimalMin("0") BigDecimal appliedVolumeM3, @DecimalMin("0") BigDecimal deficitMm, @Size(max=2000) String notes,
    @NotNull @Min(0) Long version) {}
  public record Maintenance(@NotNull MaintenanceType maintenanceType, @NotNull @PastOrPresent LocalDate scheduledOn,
    Long sectorId, Long infrastructureId, @NotNull MaintenanceStatus status, @PastOrPresent LocalDate completedOn,
    @DecimalMin("0") BigDecimal pressureKpa, @DecimalMin("0") BigDecimal flowM3h, @Size(max=2000) String notes) {}
  public record MaintenanceUpdate(@NotNull MaintenanceType maintenanceType, @NotNull @PastOrPresent LocalDate scheduledOn,
    Long sectorId, Long infrastructureId, @NotNull MaintenanceStatus status, @PastOrPresent LocalDate completedOn,
    @DecimalMin("0") BigDecimal pressureKpa, @DecimalMin("0") BigDecimal flowM3h, @Size(max=2000) String notes,
    @NotNull @Min(0) Long version) {}
  public record SensorCheck(@NotNull Long sectorId, @NotNull Long sensorDeviceId, @NotNull @PastOrPresent LocalDate checkedOn,
    @NotNull CalibrationStatus calibrationStatus, @DecimalMin("0") BigDecimal referenceValue,
    @DecimalMin("0") BigDecimal observedValue, @Size(max=150) String technician, @Size(max=2000) String notes) {}
  public record SensorCheckUpdate(@NotNull Long sectorId, @NotNull Long sensorDeviceId,
    @NotNull @PastOrPresent LocalDate checkedOn, @NotNull CalibrationStatus calibrationStatus,
    @DecimalMin("0") BigDecimal referenceValue, @DecimalMin("0") BigDecimal observedValue,
    @Size(max=150) String technician, @Size(max=2000) String notes, @NotNull @Min(0) Long version) {}
}
