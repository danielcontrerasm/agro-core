package com.yourco.agro.fertilization;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.UUID;

public class FertilizationDtos {
  public enum Nutrient { N, P, K, PH, OM, CA, MG, S, B, ZN }
  public enum Unit { PERCENT, MG_KG, CMOL_KG, PH }
  public enum DoseUnit { KG_HA, G_PLANT, L_HA, ML_PLANT }
  public enum SampleType { SOIL, FOLIAR }
  public enum ReviewDecision { CONFIRMED, REQUIRES_FOLLOWUP, REJECTED }
  public enum Recurrence { NONE, WEEKLY, BIWEEKLY, MONTHLY }
  public record Result(@NotNull Nutrient nutrient, @NotNull @DecimalMin("0") @DecimalMax("1000000") BigDecimal value,
    @NotNull Unit unit, @NotBlank @Size(max=150) String method) {}
  public record Analysis(@NotNull Long blockId, @NotNull SampleType sampleType, @NotNull @PastOrPresent LocalDate sampledOn,
    @NotBlank @Size(max=150) String laboratory, @NotBlank @Size(max=100) String reference,
    @NotNull @DecimalMin("0") @DecimalMax("300") BigDecimal depthCm,
    @DecimalMin("-90") @DecimalMax("90") BigDecimal latitude, @DecimalMin("-180") @DecimalMax("180") BigDecimal longitude,
    @NotEmpty @Size(max=10) List<@Valid Result> results, @Size(max=4000) String notes) {}
  public record Plan(@NotNull Long blockId, @NotNull Long analysisId, Long inspectionId,
    @NotBlank @Size(max=100) String growthStage, @NotBlank @Size(max=4000) String diagnosis,
    @NotBlank @Size(max=2000) String objective, @NotBlank @Size(max=200) String product,
    @NotBlank @Size(max=1000) String composition, @NotNull @DecimalMin(value="0",inclusive=false) @DecimalMax("1000000") BigDecimal dose,
    @NotNull DoseUnit doseUnit, @NotNull @DecimalMin(value="0",inclusive=false) @DecimalMax("10000000") BigDecimal coverage,
    @NotBlank @Size(max=1000) String method, @NotNull LocalDate scheduledOn, @NotNull LocalTime scheduledTime,
    @NotNull Long assigneeId, @NotNull LocalDate followUpOn, Long productId, Recurrence recurrence,
    LocalDate recurrenceUntil) {
    public Plan(Long blockId, Long analysisId, Long inspectionId, String growthStage, String diagnosis,
      String objective, String product, String composition, BigDecimal dose, DoseUnit doseUnit,
      BigDecimal coverage, String method, LocalDate scheduledOn, LocalTime scheduledTime,
      Long assigneeId, LocalDate followUpOn) {
      this(blockId,analysisId,inspectionId,growthStage,diagnosis,objective,product,composition,dose,doseUnit,
        coverage,method,scheduledOn,scheduledTime,assigneeId,followUpOn,null,Recurrence.NONE,null);
    }
  }
  public record Decision(@NotNull @Min(0) Long version, @NotBlank @Size(max=4000) String reason) {}
  public record TaskAssignment(@NotNull @Min(0) Long version, @NotNull @Positive Long assigneeId) {}
  public record Application(@NotNull Instant occurredAt,
    @NotNull @DecimalMin(value="0",inclusive=false) @Digits(integer=10,fraction=6) BigDecimal quantity,
    @NotNull @DecimalMin(value="0",inclusive=false) @Digits(integer=8,fraction=6) BigDecimal coverage,
    @NotBlank @Size(max=1000) String method, @NotNull @Positive Long inventoryLotId,
    @Size(max=4000) String notes, @Positive Long taskId, @NotNull UUID operationId) {}
  public record Followup(Long analysisId, @NotBlank @Size(max=4000) String observations) {}
  public record Review(@NotNull ReviewDecision decision, @NotBlank @Size(max=4000) String notes) {}
  public record Range(@NotNull Nutrient nutrient, @NotNull Unit unit,
    @NotNull @DecimalMin("0") BigDecimal lowerBound,
    @NotNull @DecimalMin("0") BigDecimal upperBound) {}
  public record Profile(@NotNull Long farmId, @NotBlank @Size(max=150) String name,
    @NotBlank @Size(max=100) String crop, @Size(max=100) String variety,
    @NotNull SampleType sampleType, @NotBlank @Size(max=50) String version,
    @NotBlank @Size(max=1000) String source,
    @NotEmpty @Size(max=10) List<@Valid Range> ranges) {}
  public record Product(@NotNull Long farmId, @NotBlank @Size(max=80) String code,
    @NotBlank @Size(max=200) String name, @NotBlank @Size(max=1000) String composition,
    @NotNull DoseUnit defaultDoseUnit, @Size(max=4000) String notes) {}
}
