package com.yourco.agro.events.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.Instant;
import java.util.List;

public final class LegacyObservationDtos {
  private LegacyObservationDtos() {}

  public record Observation(long id, long version, String notes, String symptoms, Integer severity,
                            String problemCode, Long suspectedCatalogId, List<Revision> history) {}

  public record Revision(long version, Instant editedAt, long editedByUserId, String editorName, String reason,
                         Snapshot before, Snapshot after) {}

  public record Snapshot(String notes, String symptoms, Integer severity, String problemCode) {}

  public record Edit(@NotNull @Min(0) Long version, @NotBlank @Size(max = 4000) String reason,
                     String notes, String symptoms, Integer severity, @Size(max = 40) String problemCode) {}
}
