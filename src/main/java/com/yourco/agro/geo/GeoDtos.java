package com.yourco.agro.geo;

import jakarta.validation.constraints.NotNull;
import java.util.List;

/**
 * Minimal geometry DTOs (EPSG:4326, [lng,lat]) for MVP.
 */
public class GeoDtos {

  public static class PointDto {
    @NotNull public Double lng;
    @NotNull public Double lat;
  }

  /** LineString: [[lng,lat],[lng,lat],...] */
  public static class LineStringDto {
    @NotNull public List<List<Double>> coordinates;
  }

  /** Polygon: [[[lng,lat],...]] (outer ring only). */
  public static class PolygonDto {
    @NotNull public List<List<List<Double>>> coordinates;
  }
}
