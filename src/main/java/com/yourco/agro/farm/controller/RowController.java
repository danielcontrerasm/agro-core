package com.yourco.agro.farm.controller;

import com.yourco.agro.farm.dto.RowDtos;
import com.yourco.agro.farm.repo.RowRepository;
import com.yourco.agro.farm.service.RowService;
import jakarta.validation.Valid;
import com.yourco.agro.auth.FarmAccess;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/rows")
public class RowController {
  private final RowRepository repo;
  private final RowService service;
  private final FarmAccess access;

  public RowController(RowRepository repo, RowService service, FarmAccess access) {
    this.repo = repo;
    this.service = service;
    this.access = access;
  }

  @PostMapping
  public Object create(@Valid @RequestBody RowDtos.CreateRowRequest req) {
    access.require(access.blockFarm(req.blockId), true);
    return service.create(req);
  }

  @GetMapping
  public Object list(@RequestParam(required = false) Long blockId) {
    if (blockId != null) access.require(access.blockFarm(blockId), false);
    var farms = access.farmIds();
    var entities = blockId == null ? repo.findAll() : repo.findByBlock_Id(blockId);
    return entities.stream().filter(entity -> farms.contains(entity.getBlock().getField().getFarm().getId())).toList();
  }

  @GetMapping("/{id}")
  public Object get(@PathVariable Long id) {
    access.require(access.rowFarm(id), false);
    return repo.findById(id).orElseThrow();
  }

  @DeleteMapping("/{id}")
  public void delete(@PathVariable Long id) {
    access.require(access.rowFarm(id), true);
    repo.deleteById(id);
  }
}
