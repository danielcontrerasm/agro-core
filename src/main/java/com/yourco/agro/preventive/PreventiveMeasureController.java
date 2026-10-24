package com.yourco.agro.preventive;

import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;

import static com.yourco.agro.preventive.PreventiveMeasureDtos.*;

@RestController
@RequestMapping("/api/v1")
public class PreventiveMeasureController {
  private final PreventiveMeasureService service;

  public PreventiveMeasureController(PreventiveMeasureService service) { this.service = service; }

  @GetMapping("/preventive-measures")
  public List<Template> templates(@RequestParam long farmId) { return service.templates(farmId); }

  @PostMapping("/preventive-measures")
  @ResponseStatus(HttpStatus.CREATED)
  public Template createTemplate(@Valid @RequestBody CreateTemplate request) { return service.createTemplate(request); }

  @DeleteMapping("/preventive-measures/{id}")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  public void deactivateTemplate(@PathVariable long id) { service.deactivateTemplate(id); }

  @GetMapping("/preventive-assignments")
  public List<Assignment> assignments(@RequestParam long farmId,
                                      @RequestParam(required = false) AssignmentStatus status) {
    return service.assignments(farmId, status);
  }

  @PostMapping("/preventive-assignments")
  @ResponseStatus(HttpStatus.CREATED)
  public Assignment createAssignment(@Valid @RequestBody CreateAssignment request) {
    return service.createAssignment(request);
  }

  @PatchMapping("/preventive-assignments/{id}")
  public Assignment updateAssignment(@PathVariable long id, @Valid @RequestBody UpdateAssignment request) {
    return service.updateAssignment(id, request);
  }

  @GetMapping("/preventive-assignments/{id}/evidence")
  public List<Evidence> evidence(@PathVariable long id) { return service.evidence(id); }

  @PostMapping("/preventive-assignments/{id}/evidence")
  public Evidence addEvidence(@PathVariable long id, @Valid @RequestBody EvidenceRequest request) {
    return service.addEvidence(id, request);
  }
}
