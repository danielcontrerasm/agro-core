package com.yourco.agro.events.controller;

import com.yourco.agro.events.repo.FieldEventRepository;
import com.yourco.agro.farm.repo.RowRepository;
import org.locationtech.jts.geom.LineString;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.*;
import com.yourco.agro.auth.FarmAccess;

@RestController
@RequestMapping("/api/v1/map")
public class MapLayerController {
  private final FieldEventRepository eventRepo;
  private final RowRepository rowRepo;
  private final FarmAccess access;

  public MapLayerController(FieldEventRepository eventRepo, RowRepository rowRepo, FarmAccess access) {
    this.eventRepo = eventRepo;
    this.rowRepo = rowRepo;
    this.access = access;
  }

  @GetMapping("/rows/disease")
  public Map<String, Object> rowDisease(
    @RequestParam(required = false) Long farmId,
    @RequestParam(required = false) Instant from,
    @RequestParam(required = false) Instant to
  ) {
    if (farmId != null) access.require(farmId, false);
    var farms = access.farmIds();
    List<Object[]> agg = eventRepo.aggregateRowDisease(farmId, from, to);

    List<Map<String, Object>> features = new ArrayList<>();
    for (Object[] r : agg) {
      Long rowId = (Long) r[0];
      if (!farms.contains(access.rowFarm(rowId))) continue;
      Integer maxSeverity = ((Number) r[1]).intValue();
      Long count = ((Number) r[2]).longValue();
      Instant lastAt = (Instant) r[3];

      var row = rowRepo.findById(rowId).orElseThrow();
      LineString geom = row.getGeom();

      Map<String,Object> feature = new LinkedHashMap<>();
      feature.put("type", "Feature");
      feature.put("geometry", toGeoJsonLineString(geom));

      Map<String,Object> props = new LinkedHashMap<>();
      props.put("rowId", rowId);
      props.put("rowCode", row.getRowCode());
      props.put("maxSeverity", maxSeverity);
      props.put("countObservations", count);
      props.put("lastObservedAt", lastAt == null ? null : lastAt.toString());

      feature.put("properties", props);
      features.add(feature);
    }

    return Map.of("type", "FeatureCollection", "features", features);
  }

  private Map<String,Object> toGeoJsonLineString(LineString ls) {
    List<List<Double>> coords = new ArrayList<>();
    for (int i = 0; i < ls.getNumPoints(); i++) {
      var c = ls.getCoordinateN(i);
      coords.add(List.of(c.getX(), c.getY()));
    }
    return Map.of("type","LineString","coordinates",coords);
  }
}
