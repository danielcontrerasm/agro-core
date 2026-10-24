package com.yourco.agro.catalog;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.List;

public final class CropCatalogDtos {
  private CropCatalogDtos() {}

  public record Variety(Long id, Long cropId, String code, String name, boolean active) {}

  public record Crop(Long id, Long farmId, String code, String name, boolean active, List<Variety> varieties) {}

  public record CreateCrop(
    @NotNull Long farmId,
    @NotBlank @Size(max = 100) String code,
    @NotBlank @Size(max = 150) String name) {}

  public record CreateVariety(
    @NotBlank @Size(max = 100) String code,
    @NotBlank @Size(max = 150) String name) {}

  public record Selection(Long cropId, Long varietyId, String crop, String variety) {}
}
