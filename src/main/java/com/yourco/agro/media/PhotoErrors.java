package com.yourco.agro.media;

import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.server.ResponseStatusException;

@RestControllerAdvice(assignableTypes = PhotoController.class)
public class PhotoErrors {
  @ExceptionHandler(MaxUploadSizeExceededException.class)
  public ProblemDetail tooLarge(MaxUploadSizeExceededException exception) {
    return ProblemDetail.forStatusAndDetail(HttpStatus.PAYLOAD_TOO_LARGE, "Cada foto debe pesar como máximo 10 MB");
  }

  @ExceptionHandler(ResponseStatusException.class)
  public ProblemDetail invalidPhoto(ResponseStatusException exception) {
    return ProblemDetail.forStatusAndDetail(exception.getStatusCode(), exception.getReason());
  }
}
