package com.yourco.agro.inspections;

import jakarta.validation.constraints.*;
import java.time.Instant;
import java.time.LocalDate;

public final class InspectionMonitoringDtos {
  private InspectionMonitoringDtos() {}

  public record CreatePlanRequest(
    @NotNull @Positive Long farmId,
    @NotNull @Positive Long blockId,
    @NotBlank @Size(max = 40) String problemCode,
    @NotNull LocalDate startDate,
    @NotNull @Min(1) @Max(365) Integer intervalDays,
    @DecimalMin("0") @DecimalMax("100") Double incidenceThresholdPercent
  ) {}

  public record UpdatePlanRequest(
    @NotNull @Min(0) Long version,
    @NotNull LocalDate startDate,
    @NotNull @Min(1) @Max(365) Integer intervalDays,
    @DecimalMin("0") @DecimalMax("100") Double incidenceThresholdPercent
  ) {}

  public record SetPlanActiveRequest(@NotNull @Min(0) Long version, @NotNull Boolean active) {}

  public record Plan(
    long id, long farmId, long blockId, String problemCode,
    LocalDate startDate, int intervalDays, Double incidenceThresholdPercent, boolean active,
    long version, LocalDate nextDueDate, Long lastInspectionId, LocalDate lastInspectionDate, boolean overdue
  ) {}

  public enum AlertStatus { OPEN, REVIEWED }

  public record Alert(
    long id, long planId, long inspectionId, long farmId, long blockId, String problemCode,
    double incidencePercent, double thresholdPercent, Instant createdAt, AlertStatus status,
    String reviewNotes, Long reviewedByUserId, Instant reviewedAt, long version, Instant inspectionCanceledAt
  ) {}

  public record ReviewAlertRequest(@NotNull @Min(0) Long version,
    @NotBlank @Size(max = 4000) String reviewNotes) {}
}
