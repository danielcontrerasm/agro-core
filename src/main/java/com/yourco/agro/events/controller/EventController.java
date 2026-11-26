package com.yourco.agro.events.controller;

import com.yourco.agro.events.dto.CreateEventRequest;
import com.yourco.agro.events.entity.EventType;
import com.yourco.agro.events.repo.FieldEventRepository;
import com.yourco.agro.events.service.EventService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import com.yourco.agro.auth.FarmAccess;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/v1/events")
public class EventController {
  private final EventService service;
  private final FieldEventRepository repo;
  private final FarmAccess access;

  public EventController(EventService service, FieldEventRepository repo, FarmAccess access) {
    this.service = service;
    this.repo = repo;
    this.access = access;
  }

  @PostMapping
  public Object create(@Valid @RequestBody CreateEventRequest req) {
    if (req.eventType == EventType.FERTILIZER_APPLICATION || req.eventType == EventType.TREATMENT_APPLICATION) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Registra la aplicación desde un plan de fertilización o una inspección fitosanitaria.");
    }
    return service.create(req);
  }

  @GetMapping
  public Object search(
    @RequestParam(required = false) Long farmId,
    @RequestParam(required = false) Instant from,
    @RequestParam(required = false) Instant to,
    @RequestParam(required = false) EventType eventType,
    @RequestParam(required = false) Long blockId,
    @RequestParam(required = false) Long rowId
  ) {
    if (farmId != null) access.require(farmId, false);
    if (blockId != null) access.require(access.blockFarm(blockId), false);
    if (rowId != null) access.require(access.rowFarm(rowId), false);
    var farms = access.farmIds();
    return repo.search(farmId, from, to, eventType, blockId, rowId).stream()
      .filter(event -> farms.contains(access.eventFarm(event.getId()))).toList();
  }

  @GetMapping("/{id}")
  public Object get(@PathVariable Long id) {
    access.require(access.eventFarm(id), false);
    return repo.findById(id).orElseThrow();
  }

  @DeleteMapping("/{id}")
  public void delete(@PathVariable Long id) {
    service.delete(id);
  }
}
