package com.yourco.agro.farm.dto;

import com.yourco.agro.geo.GeoDtos;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public class BlockDtos {
  public static class CreateBlockRequest {
    @NotNull public Long fieldId;
    @NotBlank public String code;
    public String crop = "banana";
    public Long cropId;
    public Long varietyId;
    public String variety;
    @NotNull public GeoDtos.PolygonDto polygon;
    public Double areaHa;
  }
}
