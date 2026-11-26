package com.yourco.agro.inspections;

import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;

import static com.yourco.agro.inspections.TreatmentFollowupDtos.*;

@RestController
@RequestMapping("/api/v1/inspections/{id}/treatment-followups")
public class TreatmentFollowupController {
  private final TreatmentFollowupService service;

  public TreatmentFollowupController(TreatmentFollowupService service) {
    this.service = service;
  }

  @GetMapping
  public List<Followup> list(@PathVariable long id) {
    return service.list(id);
  }

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  public Followup authorize(@PathVariable long id, @Valid @RequestBody Authorize request) {
    return service.authorize(id, request);
  }

  @PostMapping("/{followupId}/execute")
  public Followup execute(@PathVariable long id, @PathVariable long followupId, @Valid @RequestBody Execute request) {
    return service.execute(id, followupId, request);
  }

  @PostMapping("/{followupId}/verify")
  public Followup verify(@PathVariable long id, @PathVariable long followupId, @Valid @RequestBody Verify request) {
    return service.verify(id, followupId, request);
  }
}
