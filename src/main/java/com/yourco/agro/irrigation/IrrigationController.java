package com.yourco.agro.irrigation;

import jakarta.validation.Valid;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import static com.yourco.agro.irrigation.IrrigationDtos.*;

@RestController @RequestMapping("/api/v1/irrigation")
public class IrrigationController {
  private final IrrigationService service;
  public IrrigationController(IrrigationService service) { this.service=service; }
  @GetMapping public Map<String,Object> list(@RequestParam long farmId) { return service.list(farmId); }
  @PostMapping("/sectors") @ResponseStatus(HttpStatus.CREATED)
  public Map<String,Object> sector(@Valid @RequestBody Sector request) { return service.createSector(request); }
  @PostMapping("/sectors/{id}/thresholds") public Map<String,Object> thresholds(@PathVariable long id,@Valid @RequestBody Thresholds request) { return service.thresholds(id,request); }
  @PostMapping("/measurements") @ResponseStatus(HttpStatus.CREATED)
  public Map<String,Object> measurement(@Valid @RequestBody Measurement request) { return service.measure(request); }
  @PostMapping("/plans") @ResponseStatus(HttpStatus.CREATED)
  public Map<String,Object> plan(@Valid @RequestBody Plan request) { return service.schedule(request); }
  @PostMapping("/plans/{id}/task") public Map<String,Object> task(@PathVariable long id) { return service.task(id); }
  @PostMapping("/plans/{id}/cancel") public Map<String,Object> cancel(@PathVariable long id,@Valid @RequestBody Cancel request) { return service.cancel(id,request); }
  @PostMapping("/plans/{id}/executions") @ResponseStatus(HttpStatus.CREATED)
  public Map<String,Object> execution(@PathVariable long id,@Valid @RequestBody Execution request) { return service.execute(id,request); }
  @PostMapping("/recurring-schedules") @ResponseStatus(HttpStatus.CREATED)
  public Map<String,Object> recurringSchedule(@Valid @RequestBody RecurringSchedule request) { return service.createRecurringSchedule(request); }
  @PatchMapping("/recurring-schedules/{id}")
  public Map<String,Object> updateRecurringSchedule(@PathVariable long id,@Valid @RequestBody RecurringScheduleUpdate request) { return service.updateRecurringSchedule(id,request); }
  @PostMapping("/recurring-schedules/{id}/generate")
  public Map<String,Object> generateRecurringSchedule(@PathVariable long id,@RequestParam(required=false) LocalDate from,@RequestParam(required=false) LocalDate until) { return service.generateRecurringSchedule(id,from,until); }
  @PostMapping("/recurring-schedules/{id}/pause")
  public Map<String,Object> pauseRecurringSchedule(@PathVariable long id,@Valid @RequestBody RecurringScheduleAction request) { return service.changeRecurringScheduleStatus(id,"PAUSED",request); }
  @PostMapping("/recurring-schedules/{id}/resume")
  public Map<String,Object> resumeRecurringSchedule(@PathVariable long id,@Valid @RequestBody RecurringScheduleAction request) { return service.changeRecurringScheduleStatus(id,"ACTIVE",request); }
  @PostMapping("/recurring-schedules/{id}/cancel")
  public Map<String,Object> cancelRecurringSchedule(@PathVariable long id,@Valid @RequestBody RecurringScheduleAction request) { return service.changeRecurringScheduleStatus(id,"CANCELED",request); }
  @GetMapping("/recurring-schedules/{id}/preview")
  public List<Map<String,Object>> recurringPreview(@PathVariable long id,@RequestParam(required=false) LocalDate from,@RequestParam(required=false) LocalDate until) { return service.previewRecurringSchedule(id,from,until); }
  @GetMapping("/recurring-schedules/{id}/history")
  public List<Map<String,Object>> recurringHistory(@PathVariable long id) { return service.recurringScheduleHistory(id); }
  @PostMapping("/water-sources") @ResponseStatus(HttpStatus.CREATED)
  public Map<String,Object> waterSource(@Valid @RequestBody WaterSource request) { return service.createWaterSource(request); }
  @PatchMapping("/water-sources/{id}")
  public Map<String,Object> updateWaterSource(@PathVariable long id,@Valid @RequestBody WaterSourceUpdate request) { return service.updateWaterSource(id,request); }
  @PostMapping("/water-sources/{id}/quality") @ResponseStatus(HttpStatus.CREATED)
  public Map<String,Object> waterQuality(@PathVariable long id,@Valid @RequestBody WaterQuality request) { return service.addWaterQuality(id,request); }
  @PatchMapping("/water-quality/{id}")
  public Map<String,Object> updateWaterQuality(@PathVariable long id,@Valid @RequestBody WaterQualityUpdate request) { return service.updateWaterQuality(id,request); }
  @PostMapping("/infrastructure") @ResponseStatus(HttpStatus.CREATED)
  public Map<String,Object> infrastructure(@Valid @RequestBody Infrastructure request) { return service.createInfrastructure(request); }
  @PatchMapping("/infrastructure/{id}")
  public Map<String,Object> updateInfrastructure(@PathVariable long id,@Valid @RequestBody InfrastructureUpdate request) { return service.updateInfrastructure(id,request); }
  @PostMapping("/water-balances") @ResponseStatus(HttpStatus.CREATED)
  public Map<String,Object> waterBalance(@Valid @RequestBody WaterBalance request) { return service.addBalance(request); }
  @PatchMapping("/water-balances/{id}")
  public Map<String,Object> updateWaterBalance(@PathVariable long id,@Valid @RequestBody WaterBalanceUpdate request) { return service.updateBalance(id,request); }
  @PostMapping("/maintenance") @ResponseStatus(HttpStatus.CREATED)
  public Map<String,Object> maintenance(@Valid @RequestBody Maintenance request) { return service.addMaintenance(request); }
  @PatchMapping("/maintenance/{id}")
  public Map<String,Object> updateMaintenance(@PathVariable long id,@Valid @RequestBody MaintenanceUpdate request) { return service.updateMaintenance(id,request); }
  @PostMapping("/sensor-checks") @ResponseStatus(HttpStatus.CREATED)
  public Map<String,Object> sensorCheck(@Valid @RequestBody SensorCheck request) { return service.addSensorCheck(request); }
  @PatchMapping("/sensor-checks/{id}")
  public Map<String,Object> updateSensorCheck(@PathVariable long id,@Valid @RequestBody SensorCheckUpdate request) { return service.updateSensorCheck(id,request); }
  @ExceptionHandler(ResponseStatusException.class) public ProblemDetail invalid(ResponseStatusException exception) { return ProblemDetail.forStatusAndDetail(exception.getStatusCode(),exception.getReason()); }
}
