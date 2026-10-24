package com.yourco.agro.monitoring;

import com.yourco.agro.auth.FarmAccess;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;

@RestController
@RequestMapping("/api/v1/monitoring-records")
public class CropMonitoringRecordController {
  private final CropMonitoringRecordService service;
  private final CropMonitoringRecordRepository records;
  private final FarmAccess access;

  public CropMonitoringRecordController(CropMonitoringRecordService service,
                                        CropMonitoringRecordRepository records, FarmAccess access) {
    this.service = service;
    this.records = records;
    this.access = access;
  }

  @PostMapping
  public CropMonitoringRecord create(@Valid @RequestBody CropMonitoringRecordDtos.CreateRequest request) {
    return service.create(request);
  }

  @GetMapping
  public java.util.List<CropMonitoringRecord> search(
    @RequestParam(required = false) Long blockId,
    @RequestParam(required = false) MonitoringRecordType recordType,
    @RequestParam(required = false) Instant from,
    @RequestParam(required = false) Instant to) {
    return service.search(blockId, recordType, from, to);
  }

  @GetMapping("/{id}")
  public CropMonitoringRecord get(@PathVariable Long id) {
    var record = records.findById(id).orElseThrow();
    access.require(access.blockFarm(record.getBlock().getId()), false);
    return record;
  }

  @DeleteMapping("/{id}")
  public void delete(@PathVariable Long id) {
    var record = records.findById(id).orElseThrow();
    access.requireAgronomic(access.blockFarm(record.getBlock().getId()));
    records.delete(record);
  }
}
