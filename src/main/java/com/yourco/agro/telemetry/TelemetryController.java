package com.yourco.agro.telemetry;

import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;

@RestController
@RequestMapping("/api/v1")
public class TelemetryController {
  private final TelemetryService service;
  public TelemetryController(TelemetryService service) { this.service = service; }

  @PostMapping("/sensors")
  public SensorDevice createDevice(@Valid @RequestBody TelemetryDtos.CreateDeviceRequest request) { return service.createDevice(request); }
  @GetMapping("/sensors")
  public java.util.List<SensorDevice> devices(@RequestParam(required = false) Long farmId) { return service.listDevices(farmId); }
  @PostMapping("/sensors/{deviceId}/readings")
  public SensorReading reading(@PathVariable Long deviceId, @Valid @RequestBody TelemetryDtos.CreateReadingRequest request) { return service.ingest(deviceId, request); }
  @GetMapping("/sensors/{deviceId}/readings")
  public java.util.List<SensorReading> readings(@PathVariable Long deviceId, @RequestParam(required = false) Instant from, @RequestParam(required = false) Instant to) { return service.readings(deviceId, from, to); }
  @PostMapping("/alert-rules")
  public AlertRule createRule(@Valid @RequestBody TelemetryDtos.CreateRuleRequest request) { return service.createRule(request); }
  @GetMapping("/alerts")
  public java.util.List<java.util.Map<String, Object>> alerts(@RequestParam(required = false) Long farmId, @RequestParam(required = false) String status) { return service.alerts(farmId, status); }
  @PostMapping("/alerts/{alertId}/acknowledge")
  public void acknowledge(@PathVariable Long alertId) { service.acknowledge(alertId); }
}
