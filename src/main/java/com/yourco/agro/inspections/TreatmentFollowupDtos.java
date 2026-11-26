package com.yourco.agro.inspections;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PastOrPresent;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

import java.time.Instant;
import java.util.UUID;

public final class TreatmentFollowupDtos {
  private TreatmentFollowupDtos() {}

  public enum Status { AUTHORIZED, EXECUTED, VERIFIED }
  public enum Outcome { EFFECTIVE, PARTIAL, INEFFECTIVE }

  public record Authorize(
    @NotBlank @Size(max = 4000) String description,
    @Size(max = 250) String product,
    UUID requestId) {}

  public record Execute(
    @NotNull @Min(0) Long version,
    @NotNull @PastOrPresent Instant occurredAt,
    @Size(max = 80) String productLot,
    @Positive Double quantity,
    @Size(max = 40) String unit) {}

  public record Verify(
    @NotNull @Min(0) Long version,
    @NotNull @PastOrPresent Instant verifiedAt,
    @NotNull Outcome outcome,
    @NotBlank @Size(max = 4000) String notes) {}

  public record Followup(
    long id, long inspectionId, Status status, String description, String product,
    long authorizedByUserId, String authorizedByName, Instant authorizedAt,
    Long treatmentId, Long executedByUserId, String executedByName, Instant executedAt,
    String productLot, Double quantity, String unit,
    Long verifiedByUserId, String verifiedByName, Instant verifiedAt, Outcome outcome,
    String verificationNotes, long version) {}
}
