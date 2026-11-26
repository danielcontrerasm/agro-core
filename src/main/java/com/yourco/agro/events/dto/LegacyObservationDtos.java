package com.yourco.agro.events.dto;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.annotation.JsonSetter;
import com.fasterxml.jackson.annotation.Nulls;
import io.swagger.v3.oas.annotations.media.Schema;
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

  public static final class Edit {
    @NotNull @Min(0)
    private final Long version;
    @NotBlank @Size(max = 4000)
    private final String reason;

    private String notes;
    private String symptoms;
    private Integer severity;
    @Size(max = 40)
    private String problemCode;
    private boolean hasNotes;
    private boolean hasSymptoms;
    private boolean hasSeverity;
    private boolean hasProblemCode;

    @JsonCreator
    public Edit(@JsonProperty("version") Long version, @JsonProperty("reason") String reason) {
      this.version = version;
      this.reason = reason;
    }

    public Long getVersion() { return version; }
    public String getReason() { return reason; }
    @Schema(description = "Omitir conserva las notas. Enviar null las borra.", nullable = true)
    public String getNotes() { return notes; }
    @Schema(description = "Omitir conserva los síntomas. Enviar null los borra.", nullable = true)
    public String getSymptoms() { return symptoms; }
    @Schema(description = "Omitir conserva la severidad. Enviar null la borra.", nullable = true)
    public Integer getSeverity() { return severity; }
    @Schema(description = "Omitir conserva el problema. Enviar null lo borra.", nullable = true)
    public String getProblemCode() { return problemCode; }

    @JsonSetter(nulls = Nulls.SET)
    public void setNotes(String notes) {
      this.notes = notes;
      hasNotes = true;
    }

    @JsonSetter(nulls = Nulls.SET)
    public void setSymptoms(String symptoms) {
      this.symptoms = symptoms;
      hasSymptoms = true;
    }

    @JsonSetter(nulls = Nulls.SET)
    public void setSeverity(Integer severity) {
      this.severity = severity;
      hasSeverity = true;
    }

    @JsonSetter(nulls = Nulls.SET)
    public void setProblemCode(String problemCode) {
      this.problemCode = problemCode;
      hasProblemCode = true;
    }

    public boolean hasNotes() { return hasNotes; }
    public boolean hasSymptoms() { return hasSymptoms; }
    public boolean hasSeverity() { return hasSeverity; }
    public boolean hasProblemCode() { return hasProblemCode; }
  }
}
