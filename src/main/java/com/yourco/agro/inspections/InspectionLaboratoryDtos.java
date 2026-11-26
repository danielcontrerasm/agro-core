package com.yourco.agro.inspections;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

public final class InspectionLaboratoryDtos {
  private InspectionLaboratoryDtos() {}

  public enum Outcome { CONFIRMED, NOT_DETECTED, INCONCLUSIVE }

  public record RecordResult(
    @NotBlank @Size(max = 120) String sampleReference,
    @NotBlank @Size(max = 200) String laboratory,
    @NotNull LocalDate sampledOn,
    @NotNull LocalDate resultOn,
    @NotNull Outcome outcome,
    @Size(max = 4000) String notes,
    @Size(max = 1024) String reportReference,
    UUID requestId) {}

  public record LaboratoryResult(
    long id, long inspectionId, String sampleReference, String laboratory,
    LocalDate sampledOn, LocalDate resultOn, Outcome outcome, String notes, String reportReference,
    long createdByUserId, String createdByName, Instant createdAt) {}
}
