package com.yourco.agro.inspections;

import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;
import java.time.Instant;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1")
public class InspectionController {
  private final InspectionService service;
  public InspectionController(InspectionService service) { this.service = service; }

  @GetMapping("/phytosanitary-problems")
  public List<Map<String, Object>> problems() { return service.problems(); }

  @PostMapping("/inspections")
  public InspectionDtos.Inspection create(@Valid @RequestBody InspectionDtos.CreateRequest request) { return service.create(request); }

  @GetMapping("/inspections")
  public List<InspectionDtos.Inspection> list(@RequestParam(required = false) Long farmId,
    @RequestParam(required = false) Long blockId, @RequestParam(required = false) String problemCode,
    @RequestParam(required = false) Instant from, @RequestParam(required = false) Instant to) {
    return service.list(farmId, blockId, problemCode, from, to);
  }

  @GetMapping("/inspections/{id}")
  public InspectionDtos.Inspection get(@PathVariable Long id) { return service.get(id); }

  @PatchMapping("/inspections/{id}")
  public InspectionDtos.Inspection review(@PathVariable Long id, @Valid @RequestBody InspectionDtos.ReviewRequest request) { return service.review(id, request); }

  @PostMapping("/inspections/{id}/cancel")
  public InspectionDtos.Inspection cancel(@PathVariable Long id, @Valid @RequestBody InspectionDtos.CancelRequest request) { return service.cancel(id, request); }

  @GetMapping("/inspections/{id}/treatments")
  public List<InspectionDtos.Treatment> treatments(@PathVariable Long id) { return service.treatments(id); }

  @PostMapping("/inspections/{id}/treatments")
  public InspectionDtos.Treatment treatment(@PathVariable Long id, @Valid @RequestBody InspectionDtos.TreatmentRequest request) { return service.addTreatment(id, request); }

  @GetMapping("/inspections/{id}/evidence")
  public List<InspectionDtos.Evidence> evidence(@PathVariable Long id) { return service.evidence(id); }

  @PostMapping("/inspections/{id}/evidence")
  public InspectionDtos.Evidence evidence(@PathVariable Long id, @Valid @RequestBody InspectionDtos.EvidenceRequest request) { return service.addEvidence(id, request); }
}
