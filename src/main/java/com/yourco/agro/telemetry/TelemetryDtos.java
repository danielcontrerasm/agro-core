package com.yourco.agro.telemetry;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.time.Instant;

public final class TelemetryDtos {
  private TelemetryDtos() {}
  public static class CreateDeviceRequest {
    @NotNull public Long farmId;
    public Long blockId;
    @NotBlank public String name;
    @NotBlank public String deviceKey;
  }
  public static class CreateReadingRequest {
    @NotNull public Instant recordedAt;
    public Double soilMoisture;
    public Double airHumidity;
    public Double airTemperature;
    public Double soilTemperature;
  }
  public static class CreateRuleRequest {
    @NotNull public Long farmId;
    public Long blockId;
    @NotNull public TelemetryMetric metric;
    @NotBlank public String operator;
    @NotNull public Double threshold;
    @NotBlank public String severity;
    @NotBlank public String message;
  }
}
