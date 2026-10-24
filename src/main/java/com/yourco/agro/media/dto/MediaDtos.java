package com.yourco.agro.media.dto;

import com.yourco.agro.geo.GeoDtos;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.time.Instant;

public class MediaDtos {
  public static class RegisterMediaRequest {
    @NotNull public Long eventId;
    @NotBlank public String kind;
    @NotBlank public String s3Key;
    public String contentType;
    public Instant capturedAt;
    public GeoDtos.PointDto gps;
    public String metaJson;
  }
}
