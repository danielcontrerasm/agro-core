package com.yourco.agro.events.dto;

import com.yourco.agro.events.entity.EventType;
import com.yourco.agro.geo.GeoDtos;
import jakarta.validation.constraints.NotNull;

import java.time.Instant;

public class CreateEventRequest {
  @NotNull public EventType eventType;
  @NotNull public Instant occurredAt;
  public Long createdByUserId;

  public Long blockId;
  public Long rowId;
  public Integer plantIndexStart;
  public Integer plantIndexEnd;

  public GeoDtos.PointDto geom;
  public String notes;

  public ObservationPayload observation;

  public static class ObservationPayload {
    public Long suspectedCatalogId;
    public Integer severity;
    public String symptoms;
  }
}
