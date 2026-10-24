package com.yourco.agro.planting;

import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;

import static com.yourco.agro.planting.PlantingCalendarDtos.*;

@RestController
@RequestMapping("/api/v1/planting-calendars")
public class PlantingCalendarController {
  private final PlantingCalendarService service;

  public PlantingCalendarController(PlantingCalendarService service) { this.service = service; }

  @GetMapping
  public List<CalendarRule> list(@RequestParam long farmId) { return service.list(farmId); }

  @GetMapping("/suggestions")
  public List<Suggestion> suggestions(@RequestParam long farmId, @RequestParam long cropId,
                                      @RequestParam(required = false) Long varietyId,
                                      @RequestParam(required = false) Integer year) {
    return service.suggestions(farmId, cropId, varietyId, year);
  }

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  public CalendarRule create(@Valid @RequestBody CalendarRequest request) { return service.create(request); }

  @PutMapping("/{id}")
  public CalendarRule update(@PathVariable long id, @Valid @RequestBody CalendarRequest request) {
    return service.update(id, request);
  }

  @DeleteMapping("/{id}")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  public void deactivate(@PathVariable long id) { service.deactivate(id); }
}
