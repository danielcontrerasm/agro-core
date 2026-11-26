package com.yourco.agro.farm.controller;

import com.yourco.agro.farm.dto.BlockDtos;
import com.yourco.agro.farm.repo.BlockRepository;
import com.yourco.agro.farm.service.BlockService;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import jakarta.validation.Valid;
import com.yourco.agro.auth.FarmAccess;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/blocks")
public class BlockController {
  private final BlockRepository repo;
  private final BlockService service;
  private final FarmAccess access;

  public BlockController(BlockRepository repo, BlockService service, FarmAccess access) {
    this.repo = repo;
    this.service = service;
    this.access = access;
  }

  @PostMapping
  public Object create(@Valid @RequestBody BlockDtos.CreateBlockRequest req) {
    access.require(access.fieldFarm(req.fieldId), true);
    return service.create(req);
  }

  @GetMapping
  public Object list(@RequestParam(required = false) Long fieldId) {
    if (fieldId != null) access.require(access.fieldFarm(fieldId), false);
    var farms = access.farmIds();
    var entities = fieldId == null ? repo.findAll() : repo.findByField_Id(fieldId);
    return entities.stream().filter(entity -> farms.contains(entity.getField().getFarm().getId())).toList();
  }

  @GetMapping("/{id}")
  public Object get(@PathVariable Long id) {
    access.require(access.blockFarm(id), false);
    return repo.findById(id).orElseThrow();
  }

  @DeleteMapping("/{id}")
  @ApiResponse(responseCode = "200", description = "Bloque eliminado.")
  @ApiResponse(responseCode = "409", description = "El bloque contiene tratamientos contabilizados.")
  public void delete(@PathVariable Long id) {
    access.require(access.blockFarm(id), true);
    repo.deleteById(id);
  }
}
