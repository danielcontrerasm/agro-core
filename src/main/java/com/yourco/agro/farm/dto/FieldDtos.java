package com.yourco.agro.farm.dto;

import com.yourco.agro.geo.GeoDtos;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public class FieldDtos {
  public static class CreateFieldRequest {
    @NotNull public Long farmId;
    @NotBlank public String name;
    @NotNull public GeoDtos.PolygonDto polygon;
    public Double areaHa;
  }
}
