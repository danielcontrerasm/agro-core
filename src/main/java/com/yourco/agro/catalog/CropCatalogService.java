package com.yourco.agro.catalog;

import com.yourco.agro.auth.FarmAccess;
import com.yourco.agro.persistence.JpaSql;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.*;

import static com.yourco.agro.catalog.CropCatalogDtos.*;

@Service
public class CropCatalogService {
  private final JpaSql queries;
  private final FarmAccess access;

  public CropCatalogService(JpaSql queries, FarmAccess access) {
    this.queries = queries;
    this.access = access;
  }

  public List<Crop> list(long farmId) {
    access.require(farmId, false);
    var crops = queries.select("""
      SELECT id, farm_id, code, name, active
      FROM crop_catalog WHERE farm_id = ? ORDER BY name, id
      """, result -> new Crop(result.longValue("id"), result.longValue("farm_id"),
      result.text("code"), result.text("name"), result.booleanValue("active"), List.of()), farmId);
    var varieties = queries.select("""
      SELECT id, crop_id, code, name, active
      FROM crop_variety WHERE crop_id IN (SELECT id FROM crop_catalog WHERE farm_id = ?)
      ORDER BY name, id
      """, result -> new Variety(result.longValue("id"), result.longValue("crop_id"),
      result.text("code"), result.text("name"), result.booleanValue("active")), farmId);
    var byCrop = new HashMap<Long, List<Variety>>();
    for (var variety : varieties) byCrop.computeIfAbsent(variety.cropId(), ignored -> new ArrayList<>()).add(variety);
    return crops.stream().map(crop -> new Crop(crop.id(), crop.farmId(), crop.code(), crop.name(), crop.active(),
      byCrop.getOrDefault(crop.id(), List.of()))).toList();
  }

  @Transactional
  public Crop create(CreateCrop request) {
    access.requireAgronomic(request.farmId());
    String code = normalize(request.code());
    if (exists("SELECT COUNT(*) FROM crop_catalog WHERE farm_id = ? AND code = ?", request.farmId(), code)) {
      throw conflict("Ya existe un cultivo con ese código en la finca");
    }
    long id = queries.insert("INSERT INTO crop_catalog(farm_id,code,name,created_by) VALUES (?,?,?,?)",
      request.farmId(), code, request.name().trim(), access.userId());
    return list(request.farmId()).stream().filter(crop -> crop.id().equals(id)).findFirst().orElseThrow();
  }

  @Transactional
  public Variety createVariety(long cropId, CreateVariety request) {
    var crop = crop(cropId, true);
    long selectedCropId = ((Number) crop.get("id")).longValue();
    String code = normalize(request.code());
    if (exists("SELECT COUNT(*) FROM crop_variety WHERE crop_id = ? AND code = ?", selectedCropId, code)) {
      throw conflict("Ya existe una variedad con ese código en el cultivo");
    }
    long id = queries.insert("INSERT INTO crop_variety(crop_id,code,name,created_by) VALUES (?,?,?,?)",
      selectedCropId, code, request.name().trim(), access.userId());
    return queries.selectOne("SELECT id,crop_id,code,name,active FROM crop_variety WHERE id=?",
      result -> new Variety(result.longValue("id"), result.longValue("crop_id"), result.text("code"), result.text("name"), result.booleanValue("active")), id);
  }

  public Selection resolve(long farmId, Long cropId, Long varietyId) {
    access.require(farmId, false);
    if (cropId == null) {
      if (varietyId != null) throw bad("Selecciona el cultivo antes de la variedad");
      return null;
    }
    var selectedCrop = queries.select("SELECT id,name FROM crop_catalog WHERE id=? AND farm_id=? AND active=TRUE",
      result -> new AbstractMap.SimpleEntry<>(result.longValue("id"), result.text("name")), cropId, farmId)
      .stream().findFirst().orElseThrow(() -> bad("El cultivo no pertenece a la finca o está inactivo"));
    if (varietyId == null) return new Selection(selectedCrop.getKey(), null, selectedCrop.getValue(), null);
    var selectedVariety = queries.select("""
      SELECT id,name FROM crop_variety WHERE id=? AND crop_id=? AND active=TRUE
      """, result -> new AbstractMap.SimpleEntry<>(result.longValue("id"), result.text("name")), varietyId, cropId)
      .stream().findFirst().orElseThrow(() -> bad("La variedad no pertenece al cultivo o está inactiva"));
    return new Selection(selectedCrop.getKey(), selectedVariety.getKey(), selectedCrop.getValue(), selectedVariety.getValue());
  }

  private Map<String, Object> crop(long id, boolean manage) {
    var rows = queries.rows("SELECT * FROM crop_catalog WHERE id=?", id);
    if (rows.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Cultivo no encontrado");
    var row = rows.get(0);
    if (manage) access.requireAgronomic(((Number) row.get("farm_id")).longValue());
    else access.require(((Number) row.get("farm_id")).longValue(), false);
    if (!Boolean.TRUE.equals(row.get("active"))) throw bad("El cultivo está inactivo");
    return row;
  }

  private boolean exists(String query, Object... values) {
    return queries.value(query, Integer.class, values) > 0;
  }


  private String normalize(String value) { return value.trim().toLowerCase(Locale.ROOT); }
  private ResponseStatusException bad(String message) { return new ResponseStatusException(HttpStatus.BAD_REQUEST, message); }
  private ResponseStatusException conflict(String message) { return new ResponseStatusException(HttpStatus.CONFLICT, message); }
}
