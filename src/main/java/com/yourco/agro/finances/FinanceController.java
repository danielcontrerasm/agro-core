package com.yourco.agro.finances;

import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import static com.yourco.agro.finances.FinanceDtos.*;

@RestController
@RequestMapping("/api/v1/finances")
public class FinanceController {
  private final FinanceService finances;

  public FinanceController(FinanceService finances) { this.finances = finances; }

  @GetMapping
  public Month month(@RequestParam Long farmId, @RequestParam String month) {
    return finances.month(farmId, month);
  }

  @PostMapping("/entries")
  @ResponseStatus(HttpStatus.CREATED)
  public Entry createEntry(@Valid @RequestBody CreateEntry request) {
    return finances.createEntry(request);
  }

  @PatchMapping("/entries/{id}")
  public Entry updateEntry(@PathVariable long id, @Valid @RequestBody UpdateEntry request) {
    return finances.updateEntry(id, request);
  }

  @PutMapping("/budget")
  public Budget saveBudget(@Valid @RequestBody SaveBudget request) {
    return finances.saveBudget(request);
  }

  @ExceptionHandler(ResponseStatusException.class)
  public ProblemDetail requestError(ResponseStatusException error) {
    return ProblemDetail.forStatusAndDetail(error.getStatusCode(), error.getReason());
  }
}
