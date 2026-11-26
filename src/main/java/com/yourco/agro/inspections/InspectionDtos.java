package com.yourco.agro.inspections;

import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

public final class InspectionDtos {
  private InspectionDtos() {}

  public enum AssessmentStatus { SUSPECTED, CONFIRMED, DISCARDED }

  public record Problem(String code, String name, String category, boolean active) {}

  public record CreateProblemRequest(
    @NotNull Long farmId,
    @NotBlank @Size(max = 40) String code,
    @NotBlank @Size(max = 120) String name,
    @NotBlank @Size(max = 20) String category) {}

  public record UpdateProblemRequest(
    @NotNull Long farmId,
    @NotBlank @Size(max = 120) String name,
    @NotBlank @Size(max = 20) String category,
    @NotNull Boolean active) {}

  public record CreateRequest(
    @NotNull Long blockId, Long rowId, @NotBlank String problemCode,
    @NotNull @PastOrPresent Instant inspectedAt,
    @NotNull @Min(1) Integer inspectedPlants, @NotNull @Min(0) Integer affectedPlants,
    @NotNull @DecimalMin("0") Double affectedAreaHa,
    @NotBlank @Size(max = 4000) String symptoms,
    @NotNull @DecimalMin("0") @DecimalMax("100") Double severityPercent,
    @NotBlank @Size(max = 250) String severityMethod,
    @NotNull LocalDate nextVisit, Long parentInspectionId) {}

  public record ReviewRequest(
    @NotNull AssessmentStatus assessmentStatus, @NotNull Boolean resolved,
    @NotBlank @Size(max = 4000) String reviewNotes,
    @NotNull @Min(0) Long version) {}

  public record Inspection(Long id, Long farmId, Long blockId, Long rowId,
    String problemCode, String problemName, Instant inspectedAt,
    int inspectedPlants, int affectedPlants, Double affectedAreaHa, double incidencePercent,
    String symptoms, double severityPercent, String severityMethod,
    AssessmentStatus assessmentStatus, boolean resolved, LocalDate nextVisit,
    Long createdByUserId, String inspectorName, Long reviewedByUserId,
    String reviewNotes, Instant reviewedAt, long version,
    Instant canceledAt, Long canceledByUserId, String cancellationReason, Long parentInspectionId) {}

  public record CancelRequest(@NotBlank @Size(max = 4000) String reason, @NotNull @Min(0) Long version) {}

  public record TreatmentRequest(@NotNull @PastOrPresent Instant occurredAt,
    @NotBlank @Size(max = 4000) String description, @Size(max = 250) String product,
    @Positive @Digits(integer = 13, fraction = 6) BigDecimal quantity, @Size(max = 40) String unit,
    @Positive Long inventoryLotId, UUID operationId) {}

  public record Treatment(Long id, Long inspectionId, Instant occurredAt, String description,
    String product, BigDecimal quantity, String unit, Long createdByUserId, String authorName,
    Long inventoryLotId, String inventoryLotCode, Long inventoryMovementId) {}

  public enum EvidenceKind { IMAGE, DOCUMENT, VIDEO }
  public record EvidenceRequest(Long treatmentId, @NotNull EvidenceKind kind,
    @NotBlank @Size(max = 1024) String s3Key, @Size(max = 150) String contentType) {}

  public record Evidence(Long id, Long inspectionId, Long treatmentId, EvidenceKind kind,
    String s3Key, String contentType, Long createdByUserId, String authorName, Instant createdAt) {}
}
