package com.yourco.agro.catalog;

import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;

import static com.yourco.agro.catalog.CropCatalogDtos.*;

@RestController
@RequestMapping("/api/v1/catalog")
public class CropCatalogController {
  private final CropCatalogService service;

  public CropCatalogController(CropCatalogService service) { this.service = service; }

  @GetMapping("/crops")
  public List<Crop> list(@RequestParam long farmId) { return service.list(farmId); }

  @PostMapping("/crops")
  @ResponseStatus(HttpStatus.CREATED)
  public Crop create(@Valid @RequestBody CreateCrop request) { return service.create(request); }

  @PostMapping("/crops/{cropId}/varieties")
  @ResponseStatus(HttpStatus.CREATED)
  public Variety variety(@PathVariable long cropId, @Valid @RequestBody CreateVariety request) {
    return service.createVariety(cropId, request);
  }
}
