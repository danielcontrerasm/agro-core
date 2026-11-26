package com.yourco.agro.inspections;

import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

import static com.yourco.agro.inspections.InspectionLaboratoryDtos.*;

@RestController
@RequestMapping("/api/v1/inspections/{id}/laboratory-results")
public class InspectionLaboratoryController {
  private final InspectionLaboratoryService service;

  public InspectionLaboratoryController(InspectionLaboratoryService service) {
    this.service = service;
  }

  @GetMapping
  public List<LaboratoryResult> list(@PathVariable long id) {
    return service.list(id);
  }

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  public LaboratoryResult record(@PathVariable long id, @Valid @RequestBody RecordResult request) {
    return service.record(id, request);
  }
}
