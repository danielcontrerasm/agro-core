package com.yourco.agro.inventory;

import org.springframework.http.ProblemDetail;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.server.ResponseStatusException;

@RestControllerAdvice(assignableTypes = InventoryController.class)
public class InventoryErrors {
  @ExceptionHandler(ResponseStatusException.class)
  public ProblemDetail invalid(ResponseStatusException exception) {
    return ProblemDetail.forStatusAndDetail(exception.getStatusCode(), exception.getReason());
  }
}
