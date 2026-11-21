package com.yourco.agro.inspections;

import com.yourco.agro.auth.FarmAccess;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.simple.SimpleJdbcInsert;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.dao.DataAccessException;

import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.*;

@Service
public class InspectionService {
  private final JdbcTemplate jdbc;
  private final FarmAccess access;
  private static final String SELECT = """
    SELECT i.*, f.farm_id, p.name AS problem_name, u.name AS inspector_name
    FROM phytosanitary_inspection i JOIN block b ON b.id = i.block_id
    JOIN field f ON f.id = b.field_id JOIN phytosanitary_problem p ON p.code = i.problem_code
    JOIN app_user u ON u.id = i.created_by_user_id
    """;
  private static final RowMapper<InspectionDtos.Inspection> MAPPER = (result, rowNumber) -> {
    var reviewedAt = result.getTimestamp("reviewed_at");
    var canceledAt = result.getTimestamp("canceled_at");
    int inspected = result.getInt("inspected_plants");
    int affected = result.getInt("affected_plants");
    return new InspectionDtos.Inspection(result.getLong("id"), result.getLong("farm_id"),
      result.getLong("block_id"), result.getObject("row_id", Long.class), result.getString("problem_code"),
      result.getString("problem_name"), result.getTimestamp("inspected_at").toInstant(), inspected,
      affected, result.getObject("affected_area_ha", Double.class), 100.0 * affected / inspected, result.getString("symptoms"),
      result.getDouble("severity_percent"), result.getString("severity_method"),
      InspectionDtos.AssessmentStatus.valueOf(result.getString("assessment_status")),
      result.getBoolean("resolved"), result.getDate("next_visit").toLocalDate(),
      result.getLong("created_by_user_id"), result.getString("inspector_name"),
      result.getObject("reviewed_by_user_id", Long.class), result.getString("review_notes"),
      reviewedAt == null ? null : reviewedAt.toInstant(), result.getLong("version"),
      canceledAt == null ? null : canceledAt.toInstant(), result.getObject("canceled_by_user_id", Long.class),
      result.getString("cancellation_reason"), result.getObject("parent_inspection_id", Long.class));
  };

  public InspectionService(JdbcTemplate jdbc, FarmAccess access) { this.jdbc = jdbc; this.access = access; }

  public List<InspectionDtos.Problem> problems(Long farmId, boolean includeInactive) {
    if (farmId == null) throw badRequest("La finca es obligatoria");
    access.require(farmId, false);
    String sql = "SELECT code, name, category, active FROM phytosanitary_problem";
    if (!includeInactive) sql += " WHERE active = TRUE";
    sql += " ORDER BY active DESC, name, code";
    return jdbc.query(sql, (result, rowNumber) -> new InspectionDtos.Problem(result.getString("code"),
      result.getString("name"), result.getString("category"), result.getBoolean("active")));
  }

  @Transactional
  public InspectionDtos.Problem createProblem(InspectionDtos.CreateProblemRequest request) {
    access.requireAgronomic(request.farmId());
    String code = normalizeCode(request.code());
    String category = normalizeCategory(request.category());
    if (jdbc.queryForObject("SELECT COUNT(*) FROM phytosanitary_problem WHERE code = ?", Integer.class, code) > 0) {
      throw conflict("Ya existe una plaga o enfermedad con ese código");
    }
    jdbc.update("INSERT INTO phytosanitary_problem(code, name, category, active) VALUES (?, ?, ?, TRUE)",
      code, request.name().trim(), category);
    return problem(code);
  }

  @Transactional
  public InspectionDtos.Problem updateProblem(String code, InspectionDtos.UpdateProblemRequest request) {
    access.requireAgronomic(request.farmId());
    String normalized = normalizeCode(code);
    String category = normalizeCategory(request.category());
    if (jdbc.queryForObject("SELECT COUNT(*) FROM phytosanitary_problem WHERE code = ?", Integer.class, normalized) == 0) {
      throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Problema sanitario no encontrado");
    }
    jdbc.update("UPDATE phytosanitary_problem SET name = ?, category = ?, active = ? WHERE code = ?",
      request.name().trim(), category, request.active(), normalized);
    return problem(normalized);
  }

  @Transactional
  public InspectionDtos.Problem deactivateProblem(String code, long farmId) {
    access.requireAgronomic(farmId);
    String normalized = normalizeCode(code);
    if (jdbc.update("UPDATE phytosanitary_problem SET active = FALSE WHERE code = ?", normalized) == 0) {
      throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Problema sanitario no encontrado");
    }
    return problem(normalized);
  }

  private InspectionDtos.Problem problem(String code) {
    return jdbc.query("SELECT code, name, category, active FROM phytosanitary_problem WHERE code = ?",
      (result, rowNumber) -> new InspectionDtos.Problem(result.getString("code"), result.getString("name"),
        result.getString("category"), result.getBoolean("active")), code).stream().findFirst()
      .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Problema sanitario no encontrado"));
  }

  @Transactional
  public InspectionDtos.Inspection create(InspectionDtos.CreateRequest request) {
    access.require(access.blockFarm(request.blockId()), false);
    String problemCode = normalizeCode(request.problemCode());
    if (request.rowId() != null) {
      access.require(access.rowFarm(request.rowId()), false);
      if (!request.blockId().equals(jdbc.queryForObject("SELECT block_id FROM row_line WHERE id = ?", Long.class, request.rowId()))) {
        throw badRequest("El surco debe pertenecer al bloque seleccionado");
      }
    }
    if (request.affectedPlants() > request.inspectedPlants()) throw badRequest("Las plantas afectadas no pueden superar las inspeccionadas");
    if (request.affectedAreaHa() == null || request.affectedAreaHa() < 0) throw badRequest("El área afectada no puede ser negativa");
    if (request.affectedPlants() == 0 && request.affectedAreaHa() != 0) throw badRequest("Sin plantas afectadas el área afectada debe ser cero");
    var blockArea = blockArea(request.blockId());
    if (blockArea != null && request.affectedAreaHa() > blockArea) throw badRequest("El área afectada no puede superar el área del bloque");
    if (request.affectedPlants() == 0 && request.severityPercent() != 0) throw badRequest("Sin plantas afectadas la severidad debe ser cero");
    if (request.nextVisit().isBefore(request.inspectedAt().atZone(ZoneOffset.UTC).toLocalDate())) throw badRequest("La próxima visita no puede ser anterior a la inspección");
    if (jdbc.queryForObject("SELECT COUNT(*) FROM phytosanitary_problem WHERE code = ? AND active = TRUE", Integer.class, problemCode) == 0) throw badRequest("Problema sanitario desconocido o inactivo");
    if (request.parentInspectionId() != null) {
      var parent = writable(request.parentInspectionId());
      if (!parent.blockId().equals(request.blockId()) || !Objects.equals(parent.rowId(), request.rowId())
        || !parent.problemCode().equals(problemCode) || request.inspectedAt().isBefore(parent.inspectedAt())) {
        throw badRequest("El seguimiento debe corresponder al mismo problema y ubicación, con fecha posterior");
      }
    }
    var values = new HashMap<String, Object>();
    values.put("block_id", request.blockId()); values.put("row_id", request.rowId());
    values.put("problem_code", problemCode); values.put("inspected_at", Timestamp.from(request.inspectedAt()));
    values.put("inspected_plants", request.inspectedPlants()); values.put("affected_plants", request.affectedPlants());
    values.put("affected_area_ha", request.affectedAreaHa());
    values.put("symptoms", request.symptoms()); values.put("severity_percent", request.severityPercent());
    values.put("severity_method", request.severityMethod()); values.put("next_visit", java.sql.Date.valueOf(request.nextVisit()));
    values.put("created_by_user_id", access.userId());
    values.put("parent_inspection_id", request.parentInspectionId());
    Long id = new SimpleJdbcInsert(jdbc).withTableName("phytosanitary_inspection")
      .usingColumns(values.keySet().toArray(String[]::new)).usingGeneratedKeyColumns("id")
      .executeAndReturnKey(values).longValue();
    return get(id);
  }

  public InspectionDtos.Inspection get(Long id) {
    var inspection = jdbc.query(SELECT + " WHERE i.id = ?", MAPPER, id).stream().findFirst()
      .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Inspección no encontrada"));
    access.require(inspection.farmId(), false);
    return inspection;
  }

  public List<InspectionDtos.Inspection> list(Long farmId, Long blockId, String problemCode, Instant from, Instant to) {
    if (farmId != null) access.require(farmId, false);
    if (blockId != null) access.require(access.blockFarm(blockId), false);
    if (from != null && to != null && from.isAfter(to)) throw badRequest("El rango de fechas no es válido");
    var farmIds = farmId == null ? access.farmIds() : List.of(farmId);
    var sql = new StringBuilder(SELECT + " WHERE f.farm_id = ?");
    var filters = new ArrayList<Object>();
    if (blockId != null) { sql.append(" AND i.block_id = ?"); filters.add(blockId); }
    if (problemCode != null) { sql.append(" AND i.problem_code = ?"); filters.add(problemCode); }
    if (from != null) { sql.append(" AND i.inspected_at >= ?"); filters.add(Timestamp.from(from)); }
    if (to != null) { sql.append(" AND i.inspected_at <= ?"); filters.add(Timestamp.from(to)); }
    sql.append(" ORDER BY i.inspected_at DESC, i.id DESC");
    return farmIds.stream().flatMap(id -> {
      var parameters = new ArrayList<Object>(); parameters.add(id); parameters.addAll(filters);
      return jdbc.query(sql.toString(), MAPPER, parameters.toArray()).stream();
    }).sorted(Comparator.comparing(InspectionDtos.Inspection::inspectedAt).reversed()).toList();
  }

  @Transactional
  public InspectionDtos.Inspection review(Long id, InspectionDtos.ReviewRequest request) {
    var inspection = writable(id);
    access.requireAgronomic(inspection.farmId());
    if (inspection.affectedPlants() == 0 && request.assessmentStatus() == InspectionDtos.AssessmentStatus.CONFIRMED) throw badRequest("No se puede confirmar una afectación sin plantas afectadas");
    int changed = jdbc.update("""
      UPDATE phytosanitary_inspection SET assessment_status = ?, resolved = ?, review_notes = ?,
        reviewed_by_user_id = ?, reviewed_at = ?, version = version + 1 WHERE id = ? AND version = ?
      """, request.assessmentStatus().name(), request.resolved(), request.reviewNotes(), access.userId(),
      Timestamp.from(Instant.now()), id, request.version());
    if (changed == 0) throw new ResponseStatusException(HttpStatus.CONFLICT, "La inspección cambió; actualiza antes de revisar");
    return get(id);
  }

  public String healthStatus(Long blockId, LocalDate today) {
    var inspections = list(null, blockId, null, null, null);
    var latestByTarget = new LinkedHashMap<String, InspectionDtos.Inspection>();
    for (var inspection : inspections) {
      if (inspection.canceledAt() == null) latestByTarget.putIfAbsent(inspection.problemCode() + ":" + inspection.rowId(), inspection);
    }
    var recent = latestByTarget.values().stream()
      .filter(inspection -> !inspection.inspectedAt().isBefore(today.minusDays(30).atStartOfDay(ZoneOffset.UTC).toInstant())
        && !inspection.nextVisit().isBefore(today)).toList();
    if (recent.isEmpty()) return "NO_RECENT_INSPECTION";
    if (recent.stream().anyMatch(inspection -> !inspection.resolved() && inspection.affectedPlants() > 0
      && inspection.assessmentStatus() != InspectionDtos.AssessmentStatus.DISCARDED)) return "ACTIVE_FINDINGS";
    if (latestByTarget.values().stream().anyMatch(inspection -> !inspection.resolved() && inspection.affectedPlants() > 0
      && inspection.assessmentStatus() != InspectionDtos.AssessmentStatus.DISCARDED && !recent.contains(inspection))) return "NO_RECENT_INSPECTION";
    return "NO_ACTIVE_FINDINGS";
  }

  private ResponseStatusException badRequest(String message) { return new ResponseStatusException(HttpStatus.BAD_REQUEST, message); }

  private ResponseStatusException conflict(String message) { return new ResponseStatusException(HttpStatus.CONFLICT, message); }

  private String normalizeCode(String value) {
    String normalized = value.trim().toUpperCase(Locale.ROOT).replaceAll("[^A-Z0-9]+", "_");
    if (normalized.isBlank() || normalized.length() > 40) throw badRequest("El código no es válido");
    return normalized;
  }

  private String normalizeCategory(String value) {
    String normalized = value.trim().toUpperCase(Locale.ROOT);
    if (!Set.of("DISEASE", "PEST").contains(normalized)) throw badRequest("La categoría debe ser DISEASE o PEST");
    return normalized;
  }

  private Double blockArea(Long blockId) {
    try {
      return jdbc.queryForObject("SELECT area_ha FROM block WHERE id = ?", Double.class, blockId);
    } catch (DataAccessException ignored) {
      return null;
    }
  }

  private InspectionDtos.Inspection writable(Long id) {
    get(id);
    jdbc.queryForObject("SELECT id FROM phytosanitary_inspection WHERE id = ? FOR UPDATE", Long.class, id);
    var inspection = get(id);
    if (inspection.canceledAt() != null) throw new ResponseStatusException(HttpStatus.CONFLICT, "La inspección está anulada");
    return inspection;
  }

  @Transactional
  public InspectionDtos.Inspection cancel(Long id, InspectionDtos.CancelRequest request) {
    var inspection = writable(id);
    access.requireAgronomic(inspection.farmId());
    int changed = jdbc.update("""
      UPDATE phytosanitary_inspection SET canceled_at = ?, canceled_by_user_id = ?, cancellation_reason = ?,
      version = version + 1 WHERE id = ? AND version = ? AND canceled_at IS NULL
      """, Timestamp.from(Instant.now()), access.userId(), request.reason().trim(), id, request.version());
    if (changed == 0) throw new ResponseStatusException(HttpStatus.CONFLICT, "La inspección cambió; actualiza antes de anular");
    return get(id);
  }

  public List<InspectionDtos.Treatment> treatments(Long id) {
    get(id);
    return jdbc.query("""
      SELECT t.*, u.name AS author_name FROM inspection_treatment t JOIN app_user u ON u.id = t.created_by_user_id
      WHERE t.inspection_id = ? ORDER BY t.occurred_at DESC, t.id DESC
      """, (result, rowNumber) -> new InspectionDtos.Treatment(result.getLong("id"), result.getLong("inspection_id"),
      result.getTimestamp("occurred_at").toInstant(), result.getString("description"), result.getString("product"),
      result.getObject("quantity", Double.class), result.getString("unit"), result.getLong("created_by_user_id"), result.getString("author_name")), id);
  }

  @Transactional
  public InspectionDtos.Treatment addTreatment(Long id, InspectionDtos.TreatmentRequest request) {
    var inspection = writable(id);
    if (request.occurredAt().isBefore(inspection.inspectedAt())) throw badRequest("El tratamiento no puede ser anterior a la inspección");
    if ((request.quantity() == null) != (request.unit() == null || request.unit().isBlank())) throw badRequest("Indica cantidad y unidad juntas");
    var values = new HashMap<String, Object>();
    values.put("inspection_id", id); values.put("occurred_at", Timestamp.from(request.occurredAt()));
    values.put("description", request.description().trim()); values.put("product", request.product());
    values.put("quantity", request.quantity()); values.put("unit", request.quantity() == null ? null : request.unit().trim());
    values.put("created_by_user_id", access.userId());
    long treatmentId = insert("inspection_treatment", values);
    return treatments(id).stream().filter(treatment -> treatment.id().equals(treatmentId)).findFirst().orElseThrow();
  }

  public List<InspectionDtos.Evidence> evidence(Long id) {
    get(id);
    return jdbc.query("""
      SELECT e.*, u.name AS author_name FROM inspection_evidence e JOIN app_user u ON u.id = e.created_by_user_id
      WHERE e.inspection_id = ? ORDER BY e.created_at DESC, e.id DESC
      """, (result, rowNumber) -> new InspectionDtos.Evidence(result.getLong("id"), result.getLong("inspection_id"),
      result.getObject("treatment_id", Long.class), InspectionDtos.EvidenceKind.valueOf(result.getString("kind")),
      result.getString("s3_key"), result.getString("content_type"), result.getLong("created_by_user_id"),
      result.getString("author_name"), result.getTimestamp("created_at").toInstant()), id);
  }

  @Transactional
  public InspectionDtos.Evidence addEvidence(Long id, InspectionDtos.EvidenceRequest request) {
    writable(id);
    if (request.treatmentId() != null && treatments(id).stream().noneMatch(treatment -> treatment.id().equals(request.treatmentId()))) {
      throw badRequest("El tratamiento debe pertenecer a esta inspección");
    }
    var values = new HashMap<String, Object>(); values.put("inspection_id", id); values.put("treatment_id", request.treatmentId());
    values.put("kind", request.kind().name()); values.put("s3_key", request.s3Key().trim());
    values.put("content_type", request.contentType()); values.put("created_by_user_id", access.userId());
    long evidenceId = insert("inspection_evidence", values);
    return evidence(id).stream().filter(item -> item.id().equals(evidenceId)).findFirst().orElseThrow();
  }

  private long insert(String table, Map<String, Object> values) {
    return new SimpleJdbcInsert(jdbc).withTableName(table).usingColumns(values.keySet().toArray(String[]::new))
      .usingGeneratedKeyColumns("id").executeAndReturnKey(values).longValue();
  }
}
