package com.yourco.agro.tasks;

import jakarta.validation.constraints.*;
import java.time.LocalDate;
import java.time.LocalTime;

public class TaskDtos {
  public enum Activity { fertilization, irrigation, scouting, planting, harvest }
  public enum Priority { Alta, Media, Baja }
  public enum Status { pending, progress, review, completed, blocked }

  public record CreateRequest(
    @NotNull Long farmId, Long fieldId, Long blockId, @NotNull Long assigneeId,
    @NotBlank @Size(max = 150) String title, @NotNull Activity activity,
    @NotNull LocalDate date, @NotNull LocalTime time, @NotNull Priority priority,
    @NotBlank @Size(max = 4000) String instructions) {}

  public record UpdateRequest(@NotNull Status status, @Size(max = 4000) String notes,
    @NotNull @Min(0) Long version) {}

  public record Task(String id, Long farmId, Long fieldId, Long blockId, Long assigneeId,
    String assignee, String title, Activity activity, LocalDate date, LocalTime time,
    Priority priority, Status status, String instructions, String notes, long version) {}
}
