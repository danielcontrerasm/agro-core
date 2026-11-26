package com.yourco.agro.farm.controller;

import com.yourco.agro.farm.dto.FieldDtos;
import com.yourco.agro.farm.repo.FieldRepository;
import com.yourco.agro.farm.service.FieldService;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import jakarta.validation.Valid;
import com.yourco.agro.auth.FarmAccess;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/fields")
public class FieldController {
  private final FieldRepository repo;
  private final FieldService service;
  private final FarmAccess access;

  public FieldController(FieldRepository repo, FieldService service, FarmAccess access) {
    this.repo = repo;
    this.service = service;
    this.access = access;
  }

  @PostMapping
  public Object create(@Valid @RequestBody FieldDtos.CreateFieldRequest req) {
    access.require(req.farmId, true);
    return service.create(req);
  }

  @GetMapping
  public Object list(@RequestParam(required = false) Long farmId) {
    if (farmId != null) access.require(farmId, false);
    var farms = access.farmIds();
    var entities = farmId == null ? repo.findAll() : repo.findByFarm_Id(farmId);
    return entities.stream().filter(entity -> farms.contains(entity.getFarm().getId())).toList();
  }

  @GetMapping("/{id}")
  public Object get(@PathVariable Long id) {
    access.require(access.fieldFarm(id), false);
    return repo.findById(id).orElseThrow();
  }

  @DeleteMapping("/{id}")
  @ApiResponse(responseCode = "200", description = "Campo eliminado.")
  @ApiResponse(responseCode = "409", description = "El campo contiene tratamientos contabilizados.")
  public void delete(@PathVariable Long id) {
    access.require(access.fieldFarm(id), true);
    repo.deleteById(id);
  }
}
