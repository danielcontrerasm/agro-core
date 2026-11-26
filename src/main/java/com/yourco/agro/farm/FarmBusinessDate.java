package com.yourco.agro.farm;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;

public final class FarmBusinessDate {
  private static final ZoneId COLOMBIA = ZoneId.of("America/Bogota");

  private FarmBusinessDate() {}

  public static LocalDate from(Instant instant) {
    return instant.atZone(COLOMBIA).toLocalDate();
  }

  public static LocalDate today() {
    return LocalDate.now(COLOMBIA);
  }
}
