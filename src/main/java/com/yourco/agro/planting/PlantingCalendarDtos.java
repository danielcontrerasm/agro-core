package com.yourco.agro.planting;

import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;

public final class PlantingCalendarDtos {
  private PlantingCalendarDtos() {}

  public record CalendarRequest(
    @NotNull Long farmId,
    @NotBlank @Size(max = 200) String region,
    @NotNull Long cropId,
    Long varietyId,
    @NotBlank @Size(max = 150) String seasonName,
    @Min(1) @Max(12) Integer windowFromMonth,
    @Min(1) @Max(31) Integer windowFromDay,
    @Min(1) @Max(12) Integer windowToMonth,
    @Min(1) @Max(31) Integer windowToDay,
    @NotNull Boolean perennial,
    @NotNull @Min(0) Integer preparationLeadDays,
    @Size(max = 4000) String notes) {
    @AssertTrue(message = "Las reglas anuales deben incluir una ventana completa")
    public boolean hasAnnualWindow() {
      return Boolean.TRUE.equals(perennial)
        || (windowFromMonth != null && windowFromDay != null && windowToMonth != null && windowToDay != null);
    }
  }

  public record CalendarRule(
    Long id,
    Long farmId,
    String region,
    Long cropId,
    Long varietyId,
    String crop,
    String variety,
    String seasonName,
    Integer windowFromMonth,
    Integer windowFromDay,
    Integer windowToMonth,
    Integer windowToDay,
    boolean perennial,
    Integer preparationLeadDays,
    String notes,
    boolean active) {}

  public record Suggestion(
    Long calendarId,
    Long farmId,
    String region,
    Long cropId,
    Long varietyId,
    String crop,
    String variety,
    String seasonName,
    LocalDate windowFrom,
    LocalDate windowTo,
    boolean perennial,
    Integer preparationLeadDays,
    String notes) {}
}
