package com.yourco.agro.fertilization;

import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.server.ResponseStatusException;

@RestControllerAdvice(assignableTypes=FertilizationController.class)
public class FertilizationErrors {
  @ExceptionHandler(ResponseStatusException.class)
  public ProblemDetail invalid(ResponseStatusException exception) {
    return ProblemDetail.forStatusAndDetail(exception.getStatusCode(),exception.getReason());
  }
  @ExceptionHandler(MaxUploadSizeExceededException.class)
  public ProblemDetail tooLarge(MaxUploadSizeExceededException exception) {
    return ProblemDetail.forStatusAndDetail(HttpStatus.PAYLOAD_TOO_LARGE,"El informe debe pesar como máximo 10 MB");
  }
}
