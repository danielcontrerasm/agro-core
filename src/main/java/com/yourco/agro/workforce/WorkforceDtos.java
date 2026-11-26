package com.yourco.agro.workforce;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public final class WorkforceDtos {
  private WorkforceDtos() {}

  public enum AttendanceStatus { PRESENT, ABSENT, EXCUSED }

  public record Crew(long id, String name, List<Long> memberIds, int version) {}

  public record Attendance(long id, long userId, String userName, LocalDate date, AttendanceStatus status,
                           BigDecimal hours, String notes, int version) {}

  public record Workforce(List<Crew> crews, List<Attendance> attendance) {}

  public record CreateCrew(@NotNull @Positive Long farmId, @NotBlank @Size(max = 120) String name,
                           @NotNull List<@NotNull @Positive Long> memberIds) {}

  public record UpdateCrew(@NotNull @PositiveOrZero Integer version, @NotBlank @Size(max = 120) String name,
                           @NotNull List<@NotNull @Positive Long> memberIds) {}

  public record CreateAttendance(@NotNull @Positive Long farmId, @NotNull @Positive Long userId,
                                 @NotNull LocalDate date, @NotNull AttendanceStatus status,
                                 @NotNull @DecimalMin("0") @DecimalMax("24") @Digits(integer = 2, fraction = 2) BigDecimal hours,
                                 @Size(max = 500) String notes) {}

  public record UpdateAttendance(@NotNull @PositiveOrZero Integer version, @NotNull AttendanceStatus status,
                                 @NotNull @DecimalMin("0") @DecimalMax("24") @Digits(integer = 2, fraction = 2) BigDecimal hours,
                                 @Size(max = 500) String notes) {}
}
