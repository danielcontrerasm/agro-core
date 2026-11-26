package com.yourco.agro.farm.controller;

import org.hibernate.exception.ConstraintViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.Set;

@RestControllerAdvice(assignableTypes = {BlockController.class, FieldController.class, FarmController.class})
public class FarmLocationErrors {
  // A farm cascade can reach the accounting references before the treatment delete trigger.
  private static final Set<String> ACCOUNTED_TREATMENT_CONSTRAINTS = Set.of(
    "accounted_treatment_delete_guard",
    "inspection_treatment_financial_entry_id_fkey",
    "inspection_treatment_inventory_lot_id_fkey",
    "inspection_treatment_inventory_movement_id_fkey");

  @ExceptionHandler(ConstraintViolationException.class)
  public ProblemDetail handleAccountedTreatmentDeletion(ConstraintViolationException exception) {
    String constraint = exception.getConstraintName();
    if (constraint == null || !ACCOUNTED_TREATMENT_CONSTRAINTS.contains(constraint)) {
      throw exception;
    }
    return ProblemDetail.forStatusAndDetail(HttpStatus.CONFLICT,
      "La ubicación contiene tratamientos contabilizados y no se puede eliminar.");
  }
}
