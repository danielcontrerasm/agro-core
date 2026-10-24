package com.yourco.agro.events.controller;

import com.yourco.agro.events.dto.CreateEventRequest;
import com.yourco.agro.events.entity.EventType;
import com.yourco.agro.events.repo.FieldEventRepository;
import com.yourco.agro.events.service.EventService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import com.yourco.agro.auth.FarmAccess;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/v1/events")
public class EventController {
  private final EventService service;
  private final FieldEventRepository repo;
  private final FarmAccess access;
  private final JdbcTemplate jdbc;

  public EventController(EventService service, FieldEventRepository repo, FarmAccess access, JdbcTemplate jdbc) {
    this.service = service;
    this.repo = repo;
    this.access = access;
    this.jdbc = jdbc;
  }

  @PostMapping
  public Object create(@Valid @RequestBody CreateEventRequest req) {
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
    access.require(access.eventFarm(id), true);
    if (jdbc.queryForObject("SELECT COUNT(*) FROM irrigation_execution WHERE event_id=?",Integer.class,id)>0) {
      throw new ResponseStatusException(HttpStatus.CONFLICT,"La ejecución pertenece a una programación de riego y conserva su trazabilidad; no se puede eliminar desde el historial.");
    }
    if (jdbc.queryForObject("SELECT COUNT(*) FROM fertilization_application WHERE event_id=?",Integer.class,id)>0) {
      throw new ResponseStatusException(HttpStatus.CONFLICT,"La aplicación pertenece a un plan aprobado y conserva su trazabilidad; no se puede eliminar desde el historial.");
    }
    repo.deleteById(id);
  }
}
