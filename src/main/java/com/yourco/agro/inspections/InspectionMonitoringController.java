package com.yourco.agro.inspections;

import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/v1/inspection-monitoring")
public class InspectionMonitoringController {
  private final InspectionMonitoringService monitoring;

  public InspectionMonitoringController(InspectionMonitoringService monitoring) {
    this.monitoring = monitoring;
  }

  @GetMapping("/plans")
  public List<InspectionMonitoringDtos.Plan> plans(@RequestParam long farmId) {
    return monitoring.plans(farmId);
  }

  @PostMapping("/plans")
  @ResponseStatus(HttpStatus.CREATED)
  public InspectionMonitoringDtos.Plan createPlan(@Valid @RequestBody InspectionMonitoringDtos.CreatePlanRequest request) {
    return monitoring.createPlan(request);
  }

  @PutMapping("/plans/{id}")
  public InspectionMonitoringDtos.Plan updatePlan(@PathVariable long id,
    @Valid @RequestBody InspectionMonitoringDtos.UpdatePlanRequest request) {
    return monitoring.updatePlan(id, request);
  }

  @PatchMapping("/plans/{id}")
  public InspectionMonitoringDtos.Plan setPlanActive(@PathVariable long id,
    @Valid @RequestBody InspectionMonitoringDtos.SetPlanActiveRequest request) {
    return monitoring.setPlanActive(id, request);
  }

  @GetMapping("/alerts")
  public List<InspectionMonitoringDtos.Alert> alerts(@RequestParam long farmId) {
    return monitoring.alerts(farmId);
  }

  @PostMapping("/alerts/{id}/review")
  public InspectionMonitoringDtos.Alert reviewAlert(@PathVariable long id,
    @Valid @RequestBody InspectionMonitoringDtos.ReviewAlertRequest request) {
    return monitoring.reviewAlert(id, request);
  }
}
