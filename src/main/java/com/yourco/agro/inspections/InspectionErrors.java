package com.yourco.agro.inspections;

import org.springframework.http.ProblemDetail;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.server.ResponseStatusException;

@RestControllerAdvice(assignableTypes = {InspectionController.class, TreatmentFollowupController.class,
  InspectionLaboratoryController.class})
public class InspectionErrors {
  @ExceptionHandler(ResponseStatusException.class)
  public ProblemDetail requestError(ResponseStatusException error) {
    return error.getBody();
  }
}
