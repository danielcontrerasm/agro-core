package com.yourco.agro.geo;

import org.locationtech.jts.geom.*;

import java.util.ArrayList;
import java.util.List;

public class GeoMapper {
  private final GeometryFactory gf;

  public GeoMapper() {
    this.gf = new GeometryFactory(new PrecisionModel(), 4326);
  }

  public Point toPoint(GeoDtos.PointDto dto) {
    return gf.createPoint(new Coordinate(dto.lng, dto.lat));
  }

  public LineString toLineString(GeoDtos.LineStringDto dto) {
    List<Coordinate> coords = new ArrayList<>();
    for (List<Double> c : dto.coordinates) {
      coords.add(new Coordinate(c.get(0), c.get(1)));
    }
    return gf.createLineString(coords.toArray(new Coordinate[0]));
  }

  public Polygon toPolygon(GeoDtos.PolygonDto dto) {
    if (dto.coordinates == null || dto.coordinates.isEmpty() || dto.coordinates.get(0).size() < 3) {
      throw new IllegalArgumentException("Polygon outer ring must contain at least 3 points");
    }
    List<List<Double>> ring = dto.coordinates.get(0);
    List<Coordinate> coords = new ArrayList<>();
    for (List<Double> c : ring) {
      coords.add(new Coordinate(c.get(0), c.get(1)));
    }
    Coordinate first = coords.get(0);
    Coordinate last = coords.get(coords.size() - 1);
    if (!first.equals2D(last)) {
      coords.add(new Coordinate(first.x, first.y));
    }
    LinearRing shell = gf.createLinearRing(coords.toArray(new Coordinate[0]));
    return gf.createPolygon(shell);
  }
}
