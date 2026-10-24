package com.yourco.agro.farm.dto;

import jakarta.validation.constraints.NotBlank;

public class FarmDtos {
  public static class CreateFarmRequest {
    @NotBlank public String name;
    public String country;
    public String region;
  }
}
