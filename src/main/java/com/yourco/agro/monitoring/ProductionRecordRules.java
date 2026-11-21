package com.yourco.agro.monitoring;

import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.util.Locale;
import java.util.Set;

final class ProductionRecordRules {
  static final Set<String> YIELD_UNITS = Set.of("g", "kg", "t", "lb", "cajas", "racimos", "unidades");
  static final Set<String> QUALITY_GRADES = Set.of("PREMIUM", "A", "B", "C", "REJECTED");

  private ProductionRecordRules() {}

  static String unit(String value) {
    if (value == null) return null;
    String normalized = value.trim().toLowerCase(Locale.ROOT);
    if (!YIELD_UNITS.contains(normalized)) throw bad("Unidad de rendimiento no válida");
    return normalized;
  }

  static String quality(String value) {
    if (value == null) return null;
    String normalized = value.trim().toUpperCase(Locale.ROOT);
    if (!QUALITY_GRADES.contains(normalized)) throw bad("Grado de calidad no válido");
    return normalized;
  }

  static ResponseStatusException bad(String message) {
    return new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
  }
}
