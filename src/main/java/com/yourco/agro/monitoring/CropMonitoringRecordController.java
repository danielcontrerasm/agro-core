package com.yourco.agro.monitoring;

import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;

@RestController
@RequestMapping("/api/v1/monitoring-records")
public class CropMonitoringRecordController {
  private final CropMonitoringRecordService service;

  public CropMonitoringRecordController(CropMonitoringRecordService service) {
    this.service = service;
  }

  @PostMapping
  public CropMonitoringRecord create(@Valid @RequestBody CropMonitoringRecordDtos.CreateRequest request) {
    return service.create(request);
  }

  @GetMapping
  public java.util.List<CropMonitoringRecord> search(
    @RequestParam(required = false) Long farmId,
    @RequestParam(required = false) Long blockId,
    @RequestParam(required = false) Long fieldId,
    @RequestParam(required = false) Long cropCycleId,
    @RequestParam(required = false) MonitoringRecordType recordType,
    @RequestParam(required = false) Instant from,
    @RequestParam(required = false) Instant to) {
    return service.search(farmId, blockId, fieldId, cropCycleId, recordType, from, to);
  }

  @GetMapping("/{id}")
  public CropMonitoringRecord get(@PathVariable Long id) {
    return service.get(id);
  }

  @PatchMapping("/{id}")
  public CropMonitoringRecord update(@PathVariable Long id,
                                     @Valid @RequestBody CropMonitoringRecordDtos.CreateRequest request) {
    return service.update(id, request);
  }

  @DeleteMapping("/{id}")
  public void delete(@PathVariable Long id) {
    service.delete(id);
  }
}
