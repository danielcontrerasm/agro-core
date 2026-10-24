package com.yourco.agro.fertilization;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;

public class FertilizationDtos {
  public enum Nutrient { N, P, K, PH, OM, CA, MG, S, B, ZN }
  public enum Unit { PERCENT, MG_KG, CMOL_KG, PH }
  public enum DoseUnit { KG_HA, G_PLANT, L_HA, ML_PLANT }
  public enum SampleType { SOIL, FOLIAR }
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
    @NotNull Long assigneeId, @NotNull LocalDate followUpOn) {}
  public record Decision(@NotNull @Min(0) Long version, @NotBlank @Size(max=4000) String reason) {}
  public record Application(@NotNull Instant occurredAt,
    @NotNull @DecimalMin(value="0",inclusive=false) @Digits(integer=10,fraction=6) BigDecimal quantity,
    @NotNull @DecimalMin(value="0",inclusive=false) @Digits(integer=8,fraction=6) BigDecimal coverage,
    @NotBlank @Size(max=1000) String method, @NotBlank @Size(max=150) String lot,
    @Size(max=4000) String notes) {}
  public record Followup(Long analysisId, @NotBlank @Size(max=4000) String observations) {}
}
