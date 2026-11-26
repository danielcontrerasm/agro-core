package com.yourco.agro.farm.controller;

import com.yourco.agro.farm.dto.FarmDtos;
import com.yourco.agro.farm.repo.FarmRepository;
import com.yourco.agro.farm.service.FarmService;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import jakarta.validation.Valid;
import com.yourco.agro.auth.FarmAccess;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/farms")
public class FarmController {
  private final FarmRepository repo;
  private final FarmService service;
  private final FarmAccess access;

  public FarmController(FarmRepository repo, FarmService service, FarmAccess access) {
    this.repo = repo;
    this.service = service;
    this.access = access;
  }

  @PostMapping
  public Object create(@Valid @RequestBody FarmDtos.CreateFarmRequest req) {
    return service.create(req);
  }

  @GetMapping
  public Object list() {
    return repo.findAllById(access.farmIds());
  }

  @GetMapping("/{id}")
  public Object get(@PathVariable Long id) {
    access.require(id, false);
    return repo.findById(id).orElseThrow();
  }

  @DeleteMapping("/{id}")
  @ApiResponse(responseCode = "200", description = "Finca eliminada.")
  @ApiResponse(responseCode = "409", description = "La finca contiene tratamientos contabilizados.")
  public void delete(@PathVariable Long id) {
    access.requireAdmin(id);
    repo.deleteById(id);
  }
}
