package com.yourco.agro.planting;

import jakarta.validation.constraints.*;

import java.math.BigDecimal;
import java.time.LocalDate;

public final class PlantingDtos {
  private PlantingDtos() {}

  public enum CycleStatus { DRAFT, PLANNED, ESTABLISHING, ACTIVE, CLOSED, CANCELED }
  public enum Stage { PLANNED, ESTABLISHMENT, VEGETATIVE, FLOWERING, FILLING, HARVEST, RENEWAL, CLOSED }
  public enum MaterialType { IN_VITRO, CORM, COLINO, OTHER }
  public enum MaterialStatus { ACCEPTED, REJECTED }

  public record CycleRequest(
    @NotNull Long blockId, Long rowId,
    Long cropId, Long varietyId,
    @NotBlank @Size(max = 100) String code,
    @NotBlank @Size(max = 100) String crop,
    @Size(max = 150) String variety,
    @NotNull @FutureOrPresent LocalDate plannedPlantingFrom,
    @NotNull LocalDate plannedPlantingTo,
    @FutureOrPresent LocalDate expectedHarvestOn,
    @Size(max = 4000) String notes) {}

  public record SiteAssessmentRequest(
    @NotBlank @Size(max = 2000) String previousUse,
    @Size(max = 2000) String neighboringUses,
    Long soilAnalysisId,
    @Size(max = 100) String slope,
    @NotBlank @Size(max = 2000) String drainage,
    @NotBlank @Size(max = 100) String floodingRisk,
    @Size(max = 100) String windRisk,
    @Size(max = 2000) String contaminationRisk,
    @Size(max = 2000) String phytosanitaryRisk,
    @Size(max = 2000) String environmentalRestrictions,
    @Size(max = 4000) String evidenceNotes) {}

  public record Decision(
    @NotNull @Min(0) Long version,
    @NotBlank @Size(max = 4000) String reason) {}

  public record MaterialLotRequest(
    @NotNull Long farmId, Long cycleId,
    Long cropId, Long varietyId,
    @NotNull MaterialType materialType,
    @NotBlank @Size(max = 100) String crop,
    @NotBlank @Size(max = 150) String variety,
    @NotBlank @Size(max = 200) String supplier,
    @NotBlank @Size(max = 2000) String sourceReference,
    @Size(max = 500) String certificationReference,
    @NotNull @DecimalMin(value = "0", inclusive = false) @Digits(integer = 13, fraction = 3) BigDecimal quantityReceived,
    @NotBlank @Size(max = 4000) String healthInspection) {}

  public record MaterialDecision(
    @NotNull @Min(0) Long version,
    @NotNull MaterialStatus status,
    @DecimalMin("0") @Digits(integer = 13, fraction = 3) BigDecimal quantityAccepted,
    @DecimalMin("0") @Digits(integer = 13, fraction = 3) BigDecimal quantityRejected,
    @NotBlank @Size(max = 4000) String reason) {}

  public record PlanRequest(
    @NotNull Long cycleId, @NotNull Long materialLotId,
    @NotNull @DecimalMin(value = "0", inclusive = false) @Digits(integer = 10, fraction = 6) BigDecimal plannedAreaHa,
    @NotBlank @Size(max = 150) String plantingSystem,
    @NotNull @DecimalMin(value = "0", inclusive = false) @Digits(integer = 6, fraction = 4) BigDecimal rowSpacingM,
    @NotNull @DecimalMin(value = "0", inclusive = false) @Digits(integer = 6, fraction = 4) BigDecimal plantSpacingM,
    @NotNull @DecimalMin(value = "0", inclusive = false) @Digits(integer = 10, fraction = 6) BigDecimal targetDensityHa,
    @NotNull @Min(1) Integer targetPlants,
    @NotNull LocalDate windowFrom, @NotNull LocalDate windowTo,
    @NotNull Long responsibleId,
    @NotBlank @Size(max = 4000) String technicalBasis) {}

  public record ExecutionRequest(
    @NotNull @PastOrPresent LocalDate executedOn,
    @NotNull @DecimalMin(value = "0", inclusive = false) @Digits(integer = 10, fraction = 6) BigDecimal areaHa,
    @NotNull @Min(1) Integer plantsPlanted,
    @NotNull @Min(0) Integer plantsRejected,
    @Size(max = 2000) String locationDetails,
    @Size(max = 4000) String operatorNotes) {}

  public record EstablishmentCheckRequest(
    @NotNull @PastOrPresent LocalDate checkedOn,
    @NotNull @Min(1) Integer plantsChecked,
    @NotNull @Min(0) Integer survivingPlants,
    @NotNull @Min(0) Integer deadPlants,
    @NotNull @Min(0) Integer replacedPlants,
    @Size(max = 100) String uniformity,
    @Size(max = 2000) String causes,
    @Size(max = 4000) String notes) {}

  public record StageRequest(
    @NotNull Stage stage,
    @NotNull @PastOrPresent LocalDate observedOn,
    @Size(max = 4000) String notes) {}
}
