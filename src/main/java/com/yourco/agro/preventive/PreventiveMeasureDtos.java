package com.yourco.agro.preventive;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.Instant;
import java.time.LocalDate;

public final class PreventiveMeasureDtos {
  private PreventiveMeasureDtos() {}

  public enum Category { MONITORING, SANITATION, CULTURAL, BIOLOGICAL, OTHER }
  public enum AssignmentStatus { PLANNED, IN_PROGRESS, COMPLETED }
  public enum EvidenceKind { IMAGE, DOCUMENT, VIDEO }

  public record CreateTemplate(
    @NotNull Long farmId,
    @NotBlank @Size(max = 100) String code,
    @NotBlank @Size(max = 180) String name,
    @NotNull Category category,
    @NotBlank @Size(max = 4000) String instructions) {}

  public record Template(
    Long id, Long farmId, String code, String name, Category category,
    String instructions, boolean active, Long createdByUserId, String creatorName, Instant createdAt) {}

  public record CreateAssignment(
    @NotNull Long templateId,
    @NotNull Long blockId,
    @NotNull LocalDate scheduledFor,
    Long assignedToUserId) {}

  public record UpdateAssignment(
    @NotNull AssignmentStatus status,
    @Size(max = 4000) String completionNotes,
    @NotNull @Min(0) Long version) {}

  public record Assignment(
    Long id, Long farmId, Long templateId, String templateCode, String templateName,
    Category category, String instructions, Long blockId, String blockCode,
    LocalDate scheduledFor, Long assignedToUserId, String assignedToName,
    AssignmentStatus status, String completionNotes, Instant completedAt,
    Long completedByUserId, String completedByName, Long createdByUserId,
    String creatorName, Instant createdAt, Instant updatedAt, long version) {}

  public record EvidenceRequest(
    @NotNull EvidenceKind kind,
    @NotBlank @Size(max = 1024) String s3Key,
    @Size(max = 150) String contentType) {}

  public record Evidence(
    Long id, Long assignmentId, EvidenceKind kind, String s3Key,
    String contentType, Long createdByUserId, String authorName, Instant createdAt) {}
}
