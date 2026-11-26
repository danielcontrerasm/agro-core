package com.yourco.agro.events.controller;

import com.yourco.agro.events.dto.LegacyObservationDtos.Edit;
import com.yourco.agro.events.dto.LegacyObservationDtos.Observation;
import com.yourco.agro.events.service.LegacyObservationService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/events/{id}/legacy-observation")
public class LegacyObservationController {
  private final LegacyObservationService observations;

  public LegacyObservationController(LegacyObservationService observations) {
    this.observations = observations;
  }

  @GetMapping
  public Observation get(@PathVariable long id) {
    return observations.get(id);
  }

  @PatchMapping
  public Observation edit(@PathVariable long id, @Valid @RequestBody Edit request) {
    return observations.edit(id, request);
  }
}
