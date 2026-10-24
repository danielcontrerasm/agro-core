package com.yourco.agro.farm.dto;

import com.yourco.agro.geo.GeoDtos;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public class RowDtos {
  public static class CreateRowRequest {
    @NotNull public Long blockId;
    @NotBlank public String rowCode;
    @NotNull public GeoDtos.LineStringDto line;
    public Double lengthM;
    public Double plantSpacingM = 2.0;
    public Integer plantsEstimated;
  }
}
