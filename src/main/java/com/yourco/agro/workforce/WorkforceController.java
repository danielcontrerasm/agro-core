package com.yourco.agro.workforce;

import com.yourco.agro.workforce.WorkforceDtos.*;
import jakarta.validation.Valid;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;

@RestController
@RequestMapping("/api/v1/workforce")
public class WorkforceController {
  private final WorkforceService workforce;

  public WorkforceController(WorkforceService workforce) { this.workforce = workforce; }

  @GetMapping
  public Workforce get(@RequestParam long farmId,
                       @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
    return workforce.get(farmId, date);
  }

  @PostMapping("/crews")
  @ResponseStatus(HttpStatus.CREATED)
  public Crew createCrew(@Valid @RequestBody CreateCrew request) { return workforce.createCrew(request); }

  @PatchMapping("/crews/{id}")
  public Crew updateCrew(@PathVariable long id, @Valid @RequestBody UpdateCrew request) {
    return workforce.updateCrew(id, request);
  }

  @PostMapping("/attendance")
  @ResponseStatus(HttpStatus.CREATED)
  public Attendance createAttendance(@Valid @RequestBody CreateAttendance request) {
    return workforce.createAttendance(request);
  }

  @PatchMapping("/attendance/{id}")
  public Attendance updateAttendance(@PathVariable long id, @Valid @RequestBody UpdateAttendance request) {
    return workforce.updateAttendance(id, request);
  }

  @ExceptionHandler(ResponseStatusException.class)
  public ProblemDetail failure(ResponseStatusException exception) {
    return ProblemDetail.forStatusAndDetail(exception.getStatusCode(), exception.getReason());
  }
}
