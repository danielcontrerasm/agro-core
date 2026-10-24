package com.yourco.agro.planting;

import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

import static com.yourco.agro.planting.PlantingDtos.*;

@RestController
@RequestMapping("/api/v1/planting")
public class PlantingController {
  private final PlantingService service;

  public PlantingController(PlantingService service) { this.service = service; }

  @GetMapping
  public Map<String, Object> list(@RequestParam long farmId) { return service.list(farmId); }

  @PostMapping("/cycles")
  @ResponseStatus(HttpStatus.CREATED)
  public Map<String, Object> cycle(@Valid @RequestBody CycleRequest request) { return service.createCycle(request); }

  @PostMapping("/cycles/{id}/site-assessment")
  @ResponseStatus(HttpStatus.CREATED)
  public Map<String, Object> siteAssessment(@PathVariable long id, @Valid @RequestBody SiteAssessmentRequest request) {
    return service.createSiteAssessment(id, request);
  }

  @PostMapping("/cycles/{id}/site-assessment/approve")
  public Map<String, Object> approveSite(@PathVariable long id, @Valid @RequestBody Decision request) {
    return service.decideSite(id, request, true);
  }

  @PostMapping("/cycles/{id}/site-assessment/reject")
  public Map<String, Object> rejectSite(@PathVariable long id, @Valid @RequestBody Decision request) {
    return service.decideSite(id, request, false);
  }

  @PostMapping("/material-lots")
  @ResponseStatus(HttpStatus.CREATED)
  public Map<String, Object> materialLot(@Valid @RequestBody MaterialLotRequest request) { return service.createMaterialLot(request); }

  @PostMapping("/material-lots/{id}/decision")
  public Map<String, Object> materialDecision(@PathVariable long id, @Valid @RequestBody MaterialDecision request) {
    return service.decideMaterial(id, request);
  }

  @PostMapping("/plans")
  @ResponseStatus(HttpStatus.CREATED)
  public Map<String, Object> plan(@Valid @RequestBody PlanRequest request) { return service.createPlan(request); }

  @PostMapping("/plans/{id}/approve")
  public Map<String, Object> approvePlan(@PathVariable long id, @Valid @RequestBody Decision request) {
    return service.decidePlan(id, request, true);
  }

  @PostMapping("/plans/{id}/cancel")
  public Map<String, Object> cancelPlan(@PathVariable long id, @Valid @RequestBody Decision request) {
    return service.decidePlan(id, request, false);
  }

  @PostMapping("/plans/{id}/task")
  public Map<String, Object> task(@PathVariable long id) { return service.createTask(id); }

  @PostMapping("/plans/{id}/executions")
  @ResponseStatus(HttpStatus.CREATED)
  public Map<String, Object> execution(@PathVariable long id, @Valid @RequestBody ExecutionRequest request) {
    return service.execute(id, request);
  }

  @PostMapping("/cycles/{id}/establishment-checks")
  @ResponseStatus(HttpStatus.CREATED)
  public Map<String, Object> establishment(@PathVariable long id, @Valid @RequestBody EstablishmentCheckRequest request) {
    return service.establishmentCheck(id, request);
  }

  @PostMapping("/cycles/{id}/stages")
  @ResponseStatus(HttpStatus.CREATED)
  public Map<String, Object> stage(@PathVariable long id, @Valid @RequestBody StageRequest request) {
    return service.observeStage(id, request);
  }
}
