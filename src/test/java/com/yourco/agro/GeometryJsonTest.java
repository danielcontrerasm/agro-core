package com.yourco.agro;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.yourco.agro.config.GeometryJsonConfig;
import org.junit.jupiter.api.Test;
import org.locationtech.jts.geom.*;

import static org.assertj.core.api.Assertions.assertThat;

class GeometryJsonTest {
  private final GeometryFactory geometries = new GeometryFactory(new PrecisionModel(), 4326);
  private final ObjectMapper json = new ObjectMapper().registerModule(new GeometryJsonConfig().geometryJsonModule());

  @Test
  void serializesPointAndLineAsBoundedGeoJsonRatherThanRecursiveGeometryProperties() throws Exception {
    var point = json.readTree(json.writeValueAsString(geometries.createPoint(new Coordinate(-74.1, 10.5))));
    assertThat(point.get("type").asText()).isEqualTo("Point");
    assertThat(point.get("coordinates").get(0).asDouble()).isEqualTo(-74.1);
    assertThat(point.size()).isEqualTo(2);
    var line = geometries.createLineString(new Coordinate[]{new Coordinate(-74.1, 10.5), new Coordinate(-74.2, 10.6)});
    var serialized = json.readTree(json.writeValueAsString(line));
    assertThat(serialized.get("type").asText()).isEqualTo("LineString");
    assertThat(serialized.get("coordinates").size()).isEqualTo(2);
  }

  @Test
  void preservesPolygonRingsAndCanBeReadAsCompleteJson() throws Exception {
    var shell = geometries.createLinearRing(new Coordinate[]{new Coordinate(0, 0), new Coordinate(4, 0), new Coordinate(4, 4), new Coordinate(0, 0)});
    var hole = geometries.createLinearRing(new Coordinate[]{new Coordinate(1, 1), new Coordinate(2, 1), new Coordinate(2, 2), new Coordinate(1, 1)});
    var polygon = geometries.createPolygon(shell, new LinearRing[]{hole});
    var serialized = json.readTree(json.writeValueAsString(polygon));
    assertThat(serialized.get("type").asText()).isEqualTo("Polygon");
    assertThat(serialized.get("coordinates").size()).isEqualTo(2);
    assertThat(serialized.get("coordinates").get(0).get(0)).isEqualTo(serialized.get("coordinates").get(0).get(3));
  }
}
