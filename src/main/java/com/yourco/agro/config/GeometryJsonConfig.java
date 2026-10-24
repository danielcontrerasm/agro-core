package com.yourco.agro.config;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.core.JsonGenerator;
import com.fasterxml.jackson.databind.JsonSerializer;
import com.fasterxml.jackson.databind.SerializerProvider;
import com.fasterxml.jackson.databind.module.SimpleModule;
import org.hibernate.proxy.HibernateProxy;
import org.locationtech.jts.geom.*;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.io.IOException;
import java.util.Arrays;

@Configuration
public class GeometryJsonConfig {
  @JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
  abstract static class ProxyMixin {}

  @Bean
  public SimpleModule geometryJsonModule() {
    SimpleModule module = new SimpleModule();
    module.setMixInAnnotation(HibernateProxy.class, ProxyMixin.class);
    module.addSerializer(Geometry.class, new JsonSerializer<>() {
      @Override
      public void serialize(Geometry geometry, JsonGenerator generator, SerializerProvider provider) throws IOException {
        generator.writeStartObject();
        generator.writeStringField("type", geometry.getGeometryType());
        if (geometry instanceof Point point) {
          generator.writeObjectField("coordinates", point.isEmpty() ? new double[0] : coordinate(point.getCoordinate()));
        } else if (geometry instanceof LineString line) {
          generator.writeObjectField("coordinates", coordinates(line));
        } else if (geometry instanceof Polygon polygon) {
          double[][][] rings = new double[polygon.getNumInteriorRing() + 1][][];
          rings[0] = coordinates(polygon.getExteriorRing());
          for (int index = 0; index < polygon.getNumInteriorRing(); index++) {
            rings[index + 1] = coordinates(polygon.getInteriorRingN(index));
          }
          generator.writeObjectField("coordinates", rings);
        } else {
          throw new IOException("Unsupported geometry type: " + geometry.getGeometryType());
        }
        generator.writeEndObject();
      }
    });
    return module;
  }

  private static double[] coordinate(Coordinate coordinate) {
    return new double[]{coordinate.getX(), coordinate.getY()};
  }

  private static double[][] coordinates(LineString line) {
    return Arrays.stream(line.getCoordinates()).map(GeometryJsonConfig::coordinate).toArray(double[][]::new);
  }
}
